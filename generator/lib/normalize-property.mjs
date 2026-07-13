/**
 * generator/lib/normalize-property.mjs
 * Maps a raw `secondary_listings` Supabase row to the normalized Property
 * model consumed by meta.mjs, schema.mjs, and property page generation.
 */
import { slugify } from './slugify.mjs';
import { ValidationError } from './errors.mjs';

function parseBedrooms(value) {
  if (value == null || value === '') return undefined;
  if (String(value).trim().toLowerCase() === 'studio') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseImages(imagesCsv, mainImage) {
  const rest = String(imagesCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const all = mainImage ? [mainImage, ...rest] : rest;
  return [...new Set(all)];
}

function extractYear(value) {
  if (!value) return undefined;
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate.getFullYear();
  const match = String(value).match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function shortIdSuffix(id) {
  const str = String(id);
  return str.length > 6 ? str.slice(-6) : str;
}

function parseAmenities(featuresCsv) {
  return String(featuresCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>} row Raw `secondary_listings` row.
 * @returns {object} Normalized Property model (see meta.mjs's PropertyMetaInput
 *   and schema.mjs's buildRealEstateListingSchema for the fields consumed downstream).
 *
 * Note: `name` (the listing's on-page display name/H1) intentionally does
 * NOT feed `buildingName`/`projectName` below — `row.name` is often raw ad
 * copy ("Furnished Studio | 1 Cheque | Vacant") and must never be used to
 * build SEO titles/descriptions (see meta.mjs). `buildingName`/`projectName`
 * are sourced only from their own structured columns and are left
 * undefined, not backfilled from `name`, when those columns are empty.
 */
export function normalizeSecondaryListing(row) {
  if (!row || row.id === undefined || row.id === null) {
    throw new ValidationError('normalizeSecondaryListing: row is missing "id".');
  }
  const name = row.name || row.building_name;
  if (!name) {
    throw new ValidationError(`normalizeSecondaryListing: row ${row.id} has neither "name" nor "building_name".`);
  }

  const areaName = row.location || row.city || 'Dubai';

  return {
    id: row.id,
    slug: slugify(name, { suffix: shortIdSuffix(row.id) }),
    areaSlug: slugify(areaName),
    name,
    bedrooms: parseBedrooms(row.bedrooms),
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : undefined,
    propertyType: row.property_type || 'Apartment',
    offeringType: row.offering_type === 'rent' ? 'rent' : 'sale',
    projectName: row.project_name || undefined,
    buildingName: row.building_name || undefined,
    areaName,
    city: row.city || 'Dubai',
    priceAed: row.price != null ? Number(row.price) : undefined,
    areaSqft: row.area_sqft != null ? Number(row.area_sqft) : undefined,
    handoverYear: extractYear(row.handover_date),
    description: row.description || '',
    images: parseImages(row.images, row.image_main),
    currency: 'AED',
    // Forward-compatible: these DB columns don't exist yet (SSG Spec §3);
    // accessing them on a plain row object safely yields undefined until they do.
    metaTitleOverride: row.meta_title_override || undefined,
    metaDescriptionOverride: row.meta_description_override || undefined,
    // Release 1.0.1 (Unit Detail Page V2): already-existing DB columns not
    // previously surfaced by this normalizer. No schema change.
    amenities: parseAmenities(row.features),
    permitNumber: row.dld_permit || row.rera_permit || undefined,
    agentName: row.agent || undefined,
  };
}
