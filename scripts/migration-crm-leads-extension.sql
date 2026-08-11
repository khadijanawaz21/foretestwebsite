-- ═══════════════════════════════════════════════════════════════
-- In-House CRM — Phase 1: Leads platform extension
-- Run in the Supabase SQL Editor, after
-- scripts/create-leads-platform-tables.sql and
-- scripts/add-leads-rate-limiting.sql.
--
-- Additive only. Widens `leads` to also carry Bayut/Property Finder
-- portal leads (unified inbox, not a separate table — see the CRM
-- implementation plan) and adds the auth linkage needed for real
-- per-agent/per-admin login (Phase 2). No existing row, column, or
-- other table is touched or removed.
--
-- `closed` is kept as a valid status (not replaced) — general-enquiry
-- site leads (homepage/contact/academy/golden-visa) that never enter
-- a sales pipeline still resolve to it. `assigned`/`qualified`/`won`/
-- `lost` are additions for the fuller pipeline that portal leads and
-- property-enquiry leads now go through.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Widen `leads.source` to accept portal-originated leads ──
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_valid;
ALTER TABLE leads ADD CONSTRAINT leads_source_valid
  CHECK (source IN ('homepage', 'contact', 'golden-visa', 'academy', 'property-enquiry', 'bayut', 'propertyfinder'));

-- ── Widen `leads.status` to cover the assign → work → close pipeline ──
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_valid;
ALTER TABLE leads ADD CONSTRAINT leads_status_valid
  CHECK (status IN ('new', 'assigned', 'contacted', 'qualified', 'won', 'lost', 'closed'));

-- ── New columns for portal leads ──
-- source_lead_id: the portal's own lead/reference id, used for dedupe
-- (see idx_leads_source_dedupe below). NULL for site-form leads, which
-- have no portal-side id to dedupe against.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_lead_id TEXT;

-- lead_type: portal-reported channel (call, whatsapp, email, sms,
-- phone_view, form...). NULL for site-form leads, which are all "form".
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type TEXT;

-- assigned_at: mirrors the existing contacted_at/closed_at pattern.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Note: the portal's raw payload goes in the existing `details` JSONB
-- column (already present, already used for residual form fields) —
-- no separate raw_payload column. The portal's property reference/title
-- map onto the existing property_id/property_title/property_url columns.

-- ── Dedupe index: same lead re-delivered by a poll or webhook retry
-- must not create a second row. Partial index, same pattern as
-- idx_secondary_listings_dld_permit (migration.sql /
-- migration-pf-sync.sql) — skips rows with no portal id at all.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_dedupe
  ON leads(source, source_lead_id)
  WHERE source_lead_id IS NOT NULL;

-- ── Widen `lead_activity.actor_type` to allow agents as actors ──
-- The original Phase 1 constraint only allowed ('system','admin')
-- because nothing but the system (on insert) or an admin (manual status
-- change) could act on a lead — there was no agent login. Now that
-- agents can update the status of their own assigned leads themselves,
-- 'agent' must be a valid actor_type too. Postgres auto-named this
-- constraint lead_activity_actor_type_check (no explicit name was given
-- in the original inline CHECK).
ALTER TABLE lead_activity DROP CONSTRAINT IF EXISTS lead_activity_actor_type_check;
ALTER TABLE lead_activity ADD CONSTRAINT lead_activity_actor_type_check
  CHECK (actor_type IN ('system', 'admin', 'agent'));

-- ═══════════════════════════════════════════════════════════════
-- Auth linkage (Phase 2) — connects the existing `agents` roster and
-- a small admin allow-list to real Supabase Auth identities. Deliberately
-- separate from `agents.role`, which stays a job-title display string
-- ("Real Estate Consultant") — not a permission check.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE agents ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_auth_user_id ON agents(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_admins (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON crm_admins;
CREATE POLICY "Service role full access" ON crm_admins FOR ALL USING (auth.role() = 'service_role');

COMMIT;
