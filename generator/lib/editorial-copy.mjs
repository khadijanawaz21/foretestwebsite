/**
 * generator/lib/editorial-copy.mjs
 * "FORE Insight" — Layer 1 of the approved hybrid editorial architecture
 * (Release 1.0.1). Deterministic, rule-based composition from verified
 * `secondary_listings` fields only: no AI generation, no randomization,
 * no invented facts, no marketing clichés. Every line is gated on a real
 * field being present — a listing with none of the qualifying fields
 * renders no section at all rather than padding with filler.
 *
 * Rule set (checked in this order, each independent of the others):
 *   1. Building/project context — needs buildingName/projectName + areaName.
 *      Sparse in live data today (~15% of listings have building_name set).
 *   2. Completion year — needs handoverYear. Not yet populated on any
 *      secondary listing as of the Release 1.0.1 data audit, but real and
 *      wired up for whenever it is.
 *   3. Amenity highlight — needs a non-empty `amenities` list, which the
 *      Release 1.0.1 data audit found on 41/41 live listings. This is what
 *      keeps the section from disappearing on most pages; see
 *      pickHighlightAmenities()'s doc comment for how a listing is never
 *      left with nothing to show as long as it has at least one amenity.
 *   4. Furnishing status — needs a furnishing keyword inside `amenities`.
 *      Not present in current PF sync data, but real and wired up.
 *
 * Layer 2 (a future FORE Knowledge Layer supplying area/developer/market
 * context) and Layer 3 (optional human editorial override) are
 * deliberately not implemented here. `renderForeInsightHtml`'s
 * `enrichment` parameter is the seam for Layer 2: today it is always
 * null and contributes nothing, so the section works standalone.
 */
import { escapeHtml } from './html-escape.mjs';

const FURNISHING_PATTERNS = [
  { status: 'unfurnished', pattern: /unfurnished/i },
  { status: 'semi-furnished', pattern: /semi[\s-]?furnished/i },
  { status: 'furnished', pattern: /(?<!un)(?<!semi[\s-])furnished/i },
];

/** @param {string[]} amenities @returns {string|null} */
function findFurnishingStatus(amenities) {
  if (!Array.isArray(amenities)) return null;
  const joined = amenities.join(' | ');
  for (const { status, pattern } of FURNISHING_PATTERNS) {
    if (pattern.test(joined)) return status;
  }
  return null;
}

// Deterministic priority order for which recorded amenities are worth
// surfacing as a highlight — checked in this fixed order, never randomized.
// Matched against the live `features` data (see PF sync), which is
// populated on effectively every listing (Release 1.0.1 data audit: 41/41).
const AMENITY_HIGHLIGHT_KEYWORDS = [
  'pool', 'gym', 'spa', 'security', 'concierge', 'view', 'balcony', 'parking', 'play area', 'central a',
];

/**
 * Picks up to `limit` amenities worth naming in FORE Insight. Prefers ones
 * matching a fixed, real-estate-relevant keyword (in priority order); if
 * none of the listing's actual amenities match any keyword, falls back to
 * the first `limit` amenities verbatim — still real, listed data, never invented.
 * @param {string[]} amenities @param {number} limit
 * @returns {string[]}
 */
function pickHighlightAmenities(amenities, limit) {
  if (!Array.isArray(amenities) || amenities.length === 0) return [];

  const picked = [];
  for (const keyword of AMENITY_HIGHLIGHT_KEYWORDS) {
    if (picked.length >= limit) break;
    const match = amenities.find((a) => a.toLowerCase().includes(keyword) && !picked.includes(a));
    if (match) picked.push(match);
  }
  return picked.length > 0 ? picked : amenities.slice(0, limit);
}

function joinWithAnd(items) {
  return items.length <= 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Builds the ordered list of verified-data facts for a property. Pure —
 * same input always produces the same output (no Date.now(), no Math.random()).
 * @param {object} property Normalized Property model (see normalize-property.mjs).
 * @returns {Array<{kind: string, text: string}>}
 */
export function buildForeInsightFacts(property) {
  const facts = [];
  const place = property.projectName || property.buildingName || undefined;

  if (place && property.areaName) {
    const cityPart = property.city ? `, ${property.city}` : '';
    facts.push({ kind: 'context', text: `Part of ${place} in ${property.areaName}${cityPart}.` });
  }

  if (property.handoverYear) {
    facts.push({ kind: 'completion', text: `${place || 'The building'} was completed in ${property.handoverYear}.` });
  }

  const highlightAmenities = pickHighlightAmenities(property.amenities, 2);
  if (highlightAmenities.length > 0) {
    facts.push({ kind: 'amenity', text: `Includes ${joinWithAnd(highlightAmenities)}.` });
  }

  const furnishing = findFurnishingStatus(property.amenities);
  if (furnishing) {
    facts.push({ kind: 'furnishing', text: `Offered ${furnishing}.` });
  }

  return facts.slice(0, 3);
}

/**
 * Renders the FORE Insight section's inner HTML, or '' if there is
 * nothing verified to say (the caller omits the whole section in that case).
 * @param {Array<{kind: string, text: string}>} facts From buildForeInsightFacts().
 * @param {null} [enrichment] Reserved for the future Layer 2 knowledge base;
 *   unused today — always pass null/omit.
 * @returns {string}
 */
export function renderForeInsightHtml(facts, enrichment = null) {
  void enrichment; // Layer 2 seam — not implemented yet (Release 1.0.1 ships Layer 1 only)
  if (!Array.isArray(facts) || facts.length === 0) return '';

  const items = facts.map((fact) => `<p class="fi-line">${escapeHtml(fact.text)}</p>`).join('');
  return `
    <section class="pd2-section pd2-insight">
      <div class="pd2-insight-label">FORE Insight</div>
      <div class="pd2-insight-body">${items}</div>
    </section>
  `;
}
