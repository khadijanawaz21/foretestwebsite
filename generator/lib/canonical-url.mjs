/**
 * generator/lib/canonical-url.mjs
 * Single source of truth for the generated property page's URL shape
 * (Static Page Generator Spec §4 URL pattern: /properties/{areaSlug}/
 * {listingSlug}/). Depends only on plain JS (no Node built-ins), so it
 * can be imported unmodified by both the Node generator and the live
 * site's browser-side link generation — see js/property-canonical-url.mjs.
 */

/**
 * @param {{slug: string, areaSlug: string}} property Normalized property
 *   (e.g. from normalize-property.mjs's normalizeSecondaryListing).
 * @returns {string} Site-relative path, e.g. "/properties/dubai-marina/unit-42/".
 */
export function propertyPagePath(property) {
  return `/properties/${property.areaSlug}/${property.slug}/`;
}
