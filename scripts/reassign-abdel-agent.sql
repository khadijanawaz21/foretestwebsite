-- ═══════════════════════════════════════════════════════════════
-- Release 1.1.2 — Office Contact & Agent Reassignment
-- Run in the Supabase SQL Editor.
--
-- Reassigns every public-facing secondary listing currently showing
-- Anastasiia Guseva or Dennis Gabriel Agasi to Abdel (name is the free-text
-- join key that generator/lib/agent-roster.mjs and property-detail.html
-- look up against — see that file for the roster entry itself).
--
-- Does not touch offplan_listings.agent: property-detail.html only reads
-- _agentName for secondary listings (PROP_TYPE === 'secondary'), so the
-- off-plan agent field is not publicly rendered and reassigning it has no
-- visitor-facing effect.
--
-- Does not delete or modify any row in leads / lead_activity — those keep
-- whatever agent context they already recorded.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

UPDATE secondary_listings
SET agent = 'Abdel'
WHERE agent IN ('Anastasiia Guseva', 'Dennis Gabriel Agasi');

-- Optional, no live code currently reads this table (see Phase 1 note in
-- create-leads-platform-tables.sql — "that code swap is a later step").
-- Included only to keep this dormant table's data honest: deactivate
-- without deleting (the `active` column exists specifically for this),
-- and add Abdel so the table isn't silently missing him if/when it's
-- wired up later.
UPDATE agents
SET active = false
WHERE name IN ('Anastasiia Guseva', 'Dennis Gabriel Agasi');

INSERT INTO agents (slug, name, photo_url, role, languages, email, whatsapp, phone)
VALUES ('abdel', 'Abdel', NULL, 'Real Estate Consultant', 'English, Arabic', 'info@fairopportunityrealestate.com', '971542445867', '+971 54 244 5867')
ON CONFLICT (name) DO NOTHING;

COMMIT;
