-- ═══════════════════════════════════════════════════════════════
-- Add offering_type column to secondary_listings
-- Values: 'sale' or 'rent'
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS offering_type TEXT DEFAULT 'sale';

-- Backfill existing rows based on status/annual_rent
UPDATE secondary_listings
SET offering_type = 'rent'
WHERE offering_type IS NULL
  AND (status = 'Rented' OR (annual_rent IS NOT NULL AND annual_rent > 0 AND (price IS NULL OR price = 0)));

UPDATE secondary_listings
SET offering_type = 'sale'
WHERE offering_type IS NULL;
