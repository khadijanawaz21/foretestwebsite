-- ═══════════════════════════════════════════════════════════════
-- FORE Property Type Restructure — Supabase Migration
-- Run this against your secondary_listings table
-- ═══════════════════════════════════════════════════════════════

-- Add listing type column
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'ready_secondary';
-- Values: 'secondary_offplan', 'ready_secondary', 'commercial'

-- Off-plan resale specific fields
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS developer TEXT;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS handover_date TEXT;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS payment_plan TEXT;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS completion_percentage INTEGER;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS original_price NUMERIC;

-- Commercial specific fields
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS commercial_type TEXT;
-- Values: 'office', 'retail', 'warehouse', 'full_floor', 'shop', 'showroom'
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS fitted TEXT;
-- Values: 'Fitted', 'Shell & Core', 'Furnished', 'Semi-Fitted'
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS parking_spaces INTEGER DEFAULT 0;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS rera_permit TEXT;

-- Shared new fields (useful for all types, matching PropertyFinder/Bayut standards)
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS property_type TEXT;
-- Residential values: 'Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Studio', 'Loft'
-- Commercial values: 'Office', 'Retail', 'Warehouse', 'Full Floor', 'Shop', 'Showroom', 'Land'
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS rental_yield TEXT;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS annual_rent NUMERIC;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS ownership TEXT DEFAULT 'Freehold';
-- Values: 'Freehold', 'Leasehold'
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;
ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
