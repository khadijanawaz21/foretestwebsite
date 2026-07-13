/**
 * js/property-canonical-url.mjs
 * Browser entry point for computing a secondary listing's canonical
 * static page path. Reuses the exact same slug/normalization/path-shape
 * logic the generator uses server-side (generator/lib/normalize-property.mjs,
 * generator/lib/canonical-url.mjs) — nothing here is reimplemented.
 * Loaded via dynamic import() from classic (non-module) page scripts.
 */
import { normalizeSecondaryListing } from '../generator/lib/normalize-property.mjs';
import { propertyPagePath } from '../generator/lib/canonical-url.mjs';

/**
 * @param {Record<string, unknown>} row Raw `secondary_listings` Supabase row.
 * @returns {string|null} Site-relative canonical path, or null if the row
 *   can't be normalized (e.g. missing id/name) — callers should fall back
 *   to the legacy property-detail.html?id= link in that case.
 */
export function secondaryListingCanonicalPath(row) {
  try {
    return propertyPagePath(normalizeSecondaryListing(row));
  } catch {
    return null;
  }
}
