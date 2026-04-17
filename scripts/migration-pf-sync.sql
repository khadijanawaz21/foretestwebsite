-- ═══════════════════════════════════════════════════════════════
-- Property Finder Sync — Unique constraint on dld_permit
-- Run this in Supabase SQL Editor before first sync
-- ═══════════════════════════════════════════════════════════════

-- Ensure dld_permit column exists (it should from existing schema)
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS dld_permit TEXT;

-- Add unique constraint so upserts can use it as conflict key
-- Using a partial unique index to skip empty/null permits
CREATE UNIQUE INDEX IF NOT EXISTS idx_secondary_listings_dld_permit
  ON secondary_listings (dld_permit)
  WHERE dld_permit IS NOT NULL AND dld_permit != '';
