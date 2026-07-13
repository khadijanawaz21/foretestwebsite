/**
 * generator/lib/similar-properties.mjs
 * "Similar Properties" section for the Unit Detail Page. Uses only the
 * batch's own already-fetched listing rows (Release 1.0.1: no new
 * queries or services) — pure selection + rendering, no I/O.
 */
import { escapeHtml } from './html-escape.mjs';
import { formatPriceLabel } from './price-format.mjs';

/**
 * Prefers listings in the same area; fills any remaining slots with
 * listings of the same property type elsewhere. Excludes the current
 * listing. Order is stable (whatever order `candidates` arrives in —
 * the batch's fetch order), never randomized.
 * @param {{id: *, areaSlug: string, propertyType: string}} current
 * @param {Array<{id: *, areaSlug: string, propertyType: string}>} candidates
 * @param {{limit?: number}} [options]
 */
export function pickSimilarProperties(current, candidates, { limit = 3 } = {}) {
  const others = candidates.filter((p) => p && p.id !== current.id);
  const sameArea = others.filter((p) => p.areaSlug === current.areaSlug);
  const sameAreaIds = new Set(sameArea.map((p) => p.id));
  const sameType = others.filter((p) => !sameAreaIds.has(p.id) && p.propertyType === current.propertyType);
  return [...sameArea, ...sameType].slice(0, limit);
}

function card(summary) {
  const price = formatPriceLabel(summary.priceAed, summary.offeringType);
  const image = summary.image || 'https://placehold.co/640x420?text=FORE';
  return `
    <a class="pd2-similar-card" href="${escapeHtml(summary.canonicalUrl)}">
      <div class="pd2-similar-img"><img src="${escapeHtml(image)}" alt="${escapeHtml(summary.name)}" loading="lazy" /></div>
      <div class="pd2-similar-body">
        <div class="pd2-similar-area">${escapeHtml(summary.areaName)}</div>
        <div class="pd2-similar-name">${escapeHtml(summary.name)}</div>
        <div class="pd2-similar-price">${escapeHtml(price)}</div>
      </div>
    </a>
  `;
}

/**
 * @param {Array<object>} similar From pickSimilarProperties() — each item
 *   needs {canonicalUrl, name, areaName, priceAed, offeringType, image}.
 * @returns {string} '' when there is nothing to show — caller omits the section.
 */
export function renderSimilarPropertiesHtml(similar) {
  if (!Array.isArray(similar) || similar.length === 0) return '';
  return `
    <section class="pd2-section pd2-similar">
      <h2 class="pd2-section-title">Similar Properties</h2>
      <div class="pd2-similar-grid">${similar.map(card).join('')}</div>
    </section>
  `;
}
