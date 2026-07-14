-- ═══════════════════════════════════════════════════════════════
-- Lead Experience Platform — Release 1.1, Phase 2 additive migration
-- Adds rate-limiting support to `leads`. Additive only — no existing
-- column, row, or other table is touched. Safe to re-run.
-- Run in the Supabase SQL Editor, after
-- scripts/create-leads-platform-tables.sql.
--
-- ip_hash stores a SHA-256 hash of the normalized client IP, computed
-- server-side by api/leads.js before insert — the raw IP address is
-- never persisted. Rate limiting only needs equality matching across
-- submissions, never the literal address.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ip_hash TEXT;

-- Supports the IP-burst rate-limit query: count leads for a given
-- ip_hash created within the last N minutes.
CREATE INDEX IF NOT EXISTS idx_leads_ip_hash_created ON leads(ip_hash, created_at);

-- Supports the email rate-limit query: count leads for a given email
-- created within the last N hours. Did not exist before Phase 2 —
-- the original Phase 1 migration had no index on `email`.
CREATE INDEX IF NOT EXISTS idx_leads_email_created ON leads(email, created_at);

COMMIT;
