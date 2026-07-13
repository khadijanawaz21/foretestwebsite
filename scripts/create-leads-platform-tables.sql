-- ═══════════════════════════════════════════════════════════════
-- Lead Experience Platform — Supabase migration
-- Release 1.1, Phase 1 (schema only — no application code changes).
-- Run in the Supabase SQL Editor.
--
-- Scope: agents (replaces the hardcoded roster in
-- generator/lib/agent-roster.mjs — that code swap is a later step,
-- not part of this migration), leads (unified intake for all 5
-- lead-capture forms: homepage, contact, golden-visa, academy,
-- property-enquiry), and lead_activity (minimal audit trail:
-- created / status_changed / assigned events only).
--
-- Deliberately NOT touched: secondary_listings, offplan_listings,
-- generator/, middleware.js, vercel.json. leads.property_id is a
-- loose text snapshot, not a foreign key into secondary_listings —
-- that table's id type isn't asserted here and it's out of scope
-- for this migration to touch or assume.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ── Shared trigger: keep updated_at current on every row update ──
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- agents — replaces the hardcoded ROSTER in
-- generator/lib/agent-roster.mjs. `name` stays the join key against
-- secondary_listings.agent (free-text match, unchanged this phase).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL UNIQUE,
  photo_url   TEXT,
  role        TEXT NOT NULL DEFAULT 'Real Estate Consultant',
  languages   TEXT,
  email       TEXT NOT NULL,
  whatsapp    TEXT,
  phone       TEXT,

  -- Deactivate without deleting, so lead_activity/leads.agent_id
  -- history stays intact for agents no longer taking assignments.
  active      BOOLEAN NOT NULL DEFAULT true,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS agents_set_updated_at ON agents;
CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(active) WHERE active = true;

-- Seed with the current roster (generator/lib/agent-roster.mjs) so
-- Phase 1 ships with real data, not an empty table.
INSERT INTO agents (slug, name, photo_url, role, languages, email, whatsapp, phone) VALUES
  ('anastasiia-guseva', 'Anastasiia Guseva', '/assets/team/anastasiia_new.jpeg', 'Real Estate Consultant', 'English, Russian', 'anastasiia@fairopportunityrealestate.com', '971507842145', '+971 50 784 2145'),
  ('dennis-gabriel-agasi', 'Dennis Gabriel Agasi', '/assets/team/Dennis.jpeg', 'Real Estate Consultant', 'English', 'gabrielagasi@fairopportunityrealestate.com', '971562174878', '+971 56 217 4878'),
  ('angelo-salgado', 'Angelo Salgado', '/assets/team/Angelo.jpeg', 'Real Estate Consultant', 'English', 'angelo@fairopportunityrealestate.com', '971553185538', '+971 55 318 5538'),
  ('mohammed-seddik-gacem', 'Mohammed Seddik Gacem', '/assets/team/seddik.jpeg', 'Real Estate Consultant', 'English, Arabic, French', 'mohammedseddik@fairopportunityrealestate.com', '971522720013', '+971 52 272 0013'),
  ('mohamad-asif', 'Mohamad Asif', '/assets/team/asif.jpeg', 'Real Estate Consultant', 'English, Hindi', 'mohamadasif@fairopportunityrealestate.com', '917895167309', '+91 789 516 7309'),
  ('mohammed-abubakker-sajjad', 'Mohammed Abubakker Sajjad', '/assets/team/sajjad.jpeg', 'Real Estate Consultant', 'English', 'sajjad@fairopportunityrealestate.com', '971509066257', '+971 50 906 6257')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- leads — unified intake for all 5 lead-capture forms (homepage,
-- contact, golden-visa, academy, property-enquiry). Their field
-- sets don't line up 1:1, so form-specific extras (budget, interest,
-- timeline, property situation, ...) live in `details` rather than
-- as dedicated columns, to avoid a schema migration per form change.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- full_name is always populated by Phase 2, regardless of which form
  -- shape it came from. first_name/last_name are populated only when the
  -- source form actually collects them split (homepage, contact,
  -- golden-visa) — left NULL for the single-field forms (academy,
  -- property-enquiry) rather than heuristically split.
  full_name        TEXT NOT NULL,
  first_name       TEXT,
  last_name        TEXT,
  email            TEXT NOT NULL,
  phone            TEXT,
  country          TEXT,
  message          TEXT,
  details          JSONB NOT NULL DEFAULT '{}',

  -- Origin
  source           TEXT NOT NULL CONSTRAINT leads_source_valid CHECK (source IN ('homepage', 'contact', 'golden-visa', 'academy', 'property-enquiry')),
  source_url       TEXT,
  referrer         TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,

  -- Property context — snapshot only, no FK (secondary_listings is
  -- frozen infrastructure this migration does not touch or assume
  -- the id type of).
  property_id      TEXT,
  property_title   TEXT,
  property_url     TEXT,

  -- Assignment: auto-set for property-enquiry leads to that
  -- property's agent (Phase 2 logic); general enquiries stay
  -- unassigned (NULL) until claimed via the admin inbox.
  agent_id         UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Status — deliberately minimal (no qualified/won/lost): Release
  -- 1.1 excludes negotiation-pipeline/CRM workflows.
  status           TEXT NOT NULL DEFAULT 'new' CONSTRAINT leads_status_valid CHECK (status IN ('new', 'contacted', 'closed')),
  contacted_at     TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,

  -- Nullable, no default: NULL means "not asked" (no consent UI exists
  -- on any form yet), distinct from an explicit true/false once one does.
  privacy_accepted BOOLEAN,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS leads_set_updated_at ON leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- lead_activity — minimal audit trail. Exactly three event types:
-- created (on insert), status_changed (admin inbox status update),
-- assigned (auto-assignment or manual claim of an agent).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lead_activity (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed', 'assigned')),
  from_value        TEXT,
  to_value          TEXT,

  -- Who caused this event: the system (auto-assignment on insert)
  -- or an admin (manual status change / claim). actor_identifier is
  -- e.g. an admin email — NULL when actor_type = 'system'.
  actor_type        TEXT NOT NULL CHECK (actor_type IN ('system', 'admin')),
  actor_identifier  TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity(lead_id, created_at);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security — internal/operational data only, mirroring
-- the area_enrichment_log pattern (service-role only, no public
-- SELECT/INSERT policy at all). Lead PII must never be reachable
-- via the anon key; the browser will POST to a server-side
-- /api/leads endpoint (Phase 2) that writes with the service-role
-- key, not directly to these tables.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON agents;
CREATE POLICY "Service role full access" ON agents FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON leads;
CREATE POLICY "Service role full access" ON leads FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE lead_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON lead_activity;
CREATE POLICY "Service role full access" ON lead_activity FOR ALL USING (auth.role() = 'service_role');

COMMIT;
