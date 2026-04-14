-- Run this in the Supabase SQL Editor to create the offplan_listings table

CREATE TABLE IF NOT EXISTS offplan_listings (
  project_id       TEXT PRIMARY KEY,
  short_name       TEXT NOT NULL,
  offplan_or_secondary TEXT DEFAULT 'Off-plan',
  price_min        BIGINT,
  price_max        BIGINT,
  area_min         REAL,
  area_max         REAL,
  delivery_date    BIGINT,
  created_date     BIGINT,
  avatar           TEXT,
  type_name        TEXT,
  location_address TEXT,
  location_district TEXT,
  location_city    TEXT,
  location_lat     TEXT,
  location_lng     TEXT,
  org_name         TEXT,
  org_logo         TEXT,
  currency_symbol  TEXT DEFAULT 'AED',
  currency_usd     TEXT,
  bedrooms         TEXT,
  recommended      BOOLEAN DEFAULT FALSE,
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE offplan_listings ENABLE ROW LEVEL SECURITY;

-- Public read access (anon key can read)
CREATE POLICY "Public read access" ON offplan_listings
  FOR SELECT USING (true);

-- Service role can do everything (for sync)
CREATE POLICY "Service role full access" ON offplan_listings
  FOR ALL USING (auth.role() = 'service_role');

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_offplan_org ON offplan_listings (org_name);
CREATE INDEX IF NOT EXISTS idx_offplan_created ON offplan_listings (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_offplan_delivery ON offplan_listings (delivery_date);
