-- ═══════════════════════════════════════════════════════════════
-- Area i18n + revision/slug history — Supabase migration
-- Builds on scripts/create-areas-table.sql. Run after it, in the
-- Supabase SQL Editor.
--
-- Structural changes agreed after schema review:
--   1. area_translations — locale-specific content (name, intro_copy,
--      meta_title, meta_description) moved off `areas` into its own
--      table. Keeping it on `areas` alongside a translations table
--      would mean the same English content living in two places,
--      able to diverge — the opposite of normalized.
--   2. area_revisions — append-only snapshot recorded on every
--      insert/update/delete to both `areas` and `area_translations`.
--      This is what makes slug renames and content edits recoverable;
--      it cannot be retrofitted for changes that already happened, so
--      it goes in now, before any real content exists.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. area_translations
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS area_translations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id           UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  locale            TEXT NOT NULL, -- e.g. 'en', 'ar', 'ru', 'zh'
  name              TEXT NOT NULL,
  intro_copy        TEXT,
  meta_title        TEXT,
  meta_description  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (area_id, locale)
);

CREATE TRIGGER area_translations_set_updated_at
  BEFORE UPDATE ON area_translations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_area_translations_area ON area_translations(area_id);
CREATE INDEX IF NOT EXISTS idx_area_translations_locale ON area_translations(locale);

ALTER TABLE area_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON area_translations FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON area_translations FOR ALL USING (auth.role() = 'service_role');

-- Carry forward any content already sitting in `areas` (from
-- create-areas-table.sql) as the 'en' locale before removing those columns.
INSERT INTO area_translations (area_id, locale, name, intro_copy, meta_title, meta_description)
SELECT id, 'en', name, intro_copy, meta_title, meta_description
FROM areas
WHERE name IS NOT NULL
ON CONFLICT (area_id, locale) DO NOTHING;

-- The old single-language constraint referenced a column that's being
-- removed — drop it before the column, replaced by a trigger below that
-- checks area_translations instead.
ALTER TABLE areas DROP CONSTRAINT IF EXISTS areas_published_requires_intro_copy;

ALTER TABLE areas DROP COLUMN IF EXISTS name;
ALTER TABLE areas DROP COLUMN IF EXISTS intro_copy;
ALTER TABLE areas DROP COLUMN IF EXISTS meta_title;
ALTER TABLE areas DROP COLUMN IF EXISTS meta_description;

-- `areas` now holds only locale-independent structural data (slug,
-- city_id, geo, hero_image_url, published, ai_summary/embedding,
-- timestamps). `slug` stays here, not in area_translations: it's a
-- stable cross-locale identifier, not display content.

-- Re-establish the anti-thin-content rule against area_translations —
-- a CHECK constraint can't reference another table, so this is a trigger.
CREATE OR REPLACE FUNCTION area_has_published_intro_copy(check_area_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM area_translations
    WHERE area_id = check_area_id
      AND intro_copy IS NOT NULL
      AND length(trim(intro_copy)) > 0
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION enforce_area_publish_requires_intro_copy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.published = true AND NOT area_has_published_intro_copy(NEW.id) THEN
    RAISE EXCEPTION 'areas.published requires at least one area_translations row with non-empty intro_copy for area %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER areas_enforce_publish_requires_intro_copy
  BEFORE INSERT OR UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION enforce_area_publish_requires_intro_copy();

-- ═══════════════════════════════════════════════════════════════
-- 2. area_revisions — append-only history for `areas` and
-- `area_translations`. Deliberately has NO foreign key to `areas`:
-- an audit log must survive deletion of the row it describes, so it
-- can still answer "what did this area say before it was removed."
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS area_revisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id     UUID NOT NULL,
  table_name  TEXT NOT NULL CHECK (table_name IN ('areas', 'area_translations')),
  operation   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  locale      TEXT, -- populated only when table_name = 'area_translations'
  snapshot    JSONB NOT NULL, -- full row contents at the time of the change
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_area_revisions_area ON area_revisions(area_id, changed_at DESC);

ALTER TABLE area_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON area_revisions FOR ALL USING (auth.role() = 'service_role');
-- No public SELECT policy — internal audit data only.

CREATE OR REPLACE FUNCTION record_area_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO area_revisions (area_id, table_name, operation, snapshot)
    VALUES (OLD.id, 'areas', 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  ELSE
    INSERT INTO area_revisions (area_id, table_name, operation, snapshot)
    VALUES (NEW.id, 'areas', TG_OP, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER areas_record_revision
  AFTER INSERT OR UPDATE OR DELETE ON areas
  FOR EACH ROW EXECUTE FUNCTION record_area_revision();

CREATE OR REPLACE FUNCTION record_area_translation_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO area_revisions (area_id, table_name, operation, locale, snapshot)
    VALUES (OLD.area_id, 'area_translations', 'DELETE', OLD.locale, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    INSERT INTO area_revisions (area_id, table_name, operation, locale, snapshot)
    VALUES (NEW.area_id, 'area_translations', TG_OP, NEW.locale, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER area_translations_record_revision
  AFTER INSERT OR UPDATE OR DELETE ON area_translations
  FOR EACH ROW EXECUTE FUNCTION record_area_translation_revision();

-- Slug history is not a separate table: since `slug` lives on `areas`
-- and every areas change is snapshotted above, a rename is just two
-- consecutive area_revisions rows (table_name='areas') with different
-- `snapshot->>'slug'` values, ordered by changed_at. Query that
-- directly rather than maintaining a redundant dedicated table.
