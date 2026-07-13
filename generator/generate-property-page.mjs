/**
 * generator/generate-property-page.mjs
 * Builds the Unit Detail Page (Release 1.0.1) for one secondary_listings
 * row: fetch, normalize, render through the template engine, and write a
 * static HTML file.
 *
 * Standalone script — NOT wired into build.mjs or vercel.json. Running it
 * does not affect the live site or its build. Run manually:
 *   node generator/generate-property-page.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchPublishedProperties } from './lib/supabase.mjs';
import { normalizeSecondaryListing } from './lib/normalize-property.mjs';
import { propertyPagePath } from './lib/canonical-url.mjs';
import { renderTemplate, raw } from './lib/template-engine.mjs';
import { generateTitle, generateDescription } from './lib/meta.mjs';
import { buildRealEstateListingSchema, buildBreadcrumbSchema, toJsonLdScriptTag } from './lib/schema.mjs';
import { validateGeneratedPages } from './lib/validate.mjs';
import { readRepoFile, rewriteRootRelativeUrls } from './lib/page-assets.mjs';
import { createLogger } from './lib/logger.mjs';
import { escapeHtml } from './lib/html-escape.mjs';
import { formatPriceLabel } from './lib/price-format.mjs';
import { getAgentContact } from './lib/agent-roster.mjs';
import { buildForeInsightFacts, renderForeInsightHtml } from './lib/editorial-copy.mjs';
import { pickSimilarProperties, renderSimilarPropertiesHtml } from './lib/similar-properties.mjs';
import { REPO_ROOT, GENERATOR_ROOT, config } from './config.mjs';

const logger = createLogger('generate-property-page');

function bedroomsLabel(bedrooms) {
  if (bedrooms === 0) return 'Studio';
  if (!bedrooms) return '—';
  return `${bedrooms} Bed${bedrooms > 1 ? 's' : ''}`;
}

function bathroomsLabel(bathrooms) {
  return bathrooms ? `${bathrooms} Bath${bathrooms > 1 ? 's' : ''}` : '—';
}

function areaSqftLabel(areaSqft) {
  return areaSqft ? `${Math.round(areaSqft).toLocaleString('en-US')} sq ft` : '—';
}

function badgeLabel(offeringType) {
  return offeringType === 'rent' ? 'For Rent' : 'For Sale';
}

/** Trust strip — only rendered when a real, verified permit number is present. Never invented. */
function renderTrustHtml(permitNumber) {
  if (!permitNumber) return '';
  return `
    <div class="pd2-trust">
      <span class="pd2-trust-icon">&#10003;</span>
      <span class="pd2-trust-text"><strong>Verified Listing</strong> — RERA/DLD Permit No. ${escapeHtml(permitNumber)}</span>
    </div>
  `;
}

/** Amenities grid — omitted entirely when the listing has no recorded features. */
function renderAmenitiesHtml(amenities) {
  if (!Array.isArray(amenities) || amenities.length === 0) return '';
  const items = amenities.map((a) => `<div class="pd2-amenity">${escapeHtml(a)}</div>`).join('');
  return `
    <section class="pd2-section pd2-amenities">
      <h2 class="pd2-section-title">Amenities</h2>
      <div class="pd2-amenities-grid">${items}</div>
    </section>
  `;
}

/** Agent section — omitted when no agent is assigned or the name doesn't match a known consultant. */
function renderAgentSectionHtml(agentName) {
  const agent = getAgentContact(agentName);
  if (!agent) return '';

  let buttons = '';
  if (agent.phone) {
    buttons += `<a href="tel:${escapeHtml(agent.phone.replace(/\s/g, ''))}" class="pd2-agent-btn call">Call</a>`;
  }
  if (agent.whatsapp) {
    buttons += `<a href="https://wa.me/${escapeHtml(agent.whatsapp)}" target="_blank" rel="noopener" class="pd2-agent-btn whatsapp">WhatsApp</a>`;
  }
  buttons += `<a href="mailto:${escapeHtml(agent.email)}" class="pd2-agent-btn email">Email</a>`;

  return `
    <section class="pd2-section pd2-agent">
      <h2 class="pd2-section-title">Your Agent</h2>
      <div class="pd2-agent-card">
        <img class="pd2-agent-photo" src="${escapeHtml(agent.photo)}" alt="${escapeHtml(agent.name)}" onerror="this.style.display='none'" />
        <div>
          <div class="pd2-agent-name">${escapeHtml(agent.name)}</div>
          <div class="pd2-agent-role">${escapeHtml(agent.role)}</div>
          <div class="pd2-agent-langs">${escapeHtml(agent.languages)}</div>
          <div class="pd2-agent-btns">${buttons}</div>
        </div>
      </div>
    </section>
  `;
}

/** Best-effort summary of a sibling row for the Similar Properties section — skips rows that fail to normalize. */
function summarizeSibling(row) {
  try {
    const p = normalizeSecondaryListing(row);
    return {
      id: p.id,
      areaSlug: p.areaSlug,
      areaName: p.areaName,
      propertyType: p.propertyType,
      name: p.name,
      priceAed: p.priceAed,
      offeringType: p.offeringType,
      image: p.images[0],
      canonicalUrl: `${config.siteUrl}${propertyPagePath(p)}`,
    };
  } catch {
    return null;
  }
}

/**
 * Pure page-building logic: raw Supabase row in, rendered HTML out. No
 * network or filesystem writes — safe to unit test directly.
 * @param {Record<string, unknown>} row Raw `secondary_listings` row.
 * @param {Array<Record<string, unknown>>} [siblingRows] Other published rows
 *   from the same batch fetch, used only to pick Similar Properties — no
 *   new query is made for this (Release 1.0.1).
 * @returns {{property: object, title: string, description: string, canonicalUrl: string, outputRelativePath: string, html: string}}
 */
export function buildPropertyPage(row, siblingRows = []) {
  const property = normalizeSecondaryListing(row);

  const title = generateTitle('property', property);
  const description = generateDescription('property', property);
  const canonicalUrl = `${config.siteUrl}${propertyPagePath(property)}`;

  const listingSchema = buildRealEstateListingSchema(property);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: `${config.siteUrl}/` },
    { name: 'Properties', url: `${config.siteUrl}/properties.html` },
    { name: property.name, url: canonicalUrl },
  ]);

  const nav = rewriteRootRelativeUrls(readRepoFile('components/nav.html'));
  const footer = rewriteRootRelativeUrls(readRepoFile('components/footer.html'));
  const whatsapp = rewriteRootRelativeUrls(readRepoFile('components/whatsapp.html'));

  const templateHtml = fs.readFileSync(
    path.join(GENERATOR_ROOT, 'templates', 'property.template.html'),
    'utf8'
  );

  const insightFacts = buildForeInsightFacts(property);
  const siblingSummaries = siblingRows.map(summarizeSibling).filter(Boolean);
  const similar = pickSimilarProperties(property, siblingSummaries, { limit: 3 });
  const galleryJson = JSON.stringify(property.images).replace(/<\//g, '<\\/');

  const html = renderTemplate(templateHtml, {
    TITLE: title,
    META_DESCRIPTION: description,
    CANONICAL_URL: canonicalUrl,
    OG_IMAGE: property.images[0] || `${config.siteUrl}/brand_assets/og-image.jpg`,
    JSONLD: raw(toJsonLdScriptTag([listingSchema, breadcrumbSchema])),
    NAV: raw(nav),
    FOOTER: raw(footer),
    WHATSAPP: raw(whatsapp),
    LISTING_NAME: property.name,
    LISTING_ID: property.id,
    BADGE_LABEL: badgeLabel(property.offeringType),
    AREA_NAME: property.areaName,
    CITY: property.city,
    PRICE_FORMATTED: formatPriceLabel(property.priceAed, property.offeringType),
    PROPERTY_TYPE_LABEL: property.propertyType,
    BEDROOMS_LABEL: bedroomsLabel(property.bedrooms),
    BATHROOMS_LABEL: bathroomsLabel(property.bathrooms),
    AREA_SQFT_LABEL: areaSqftLabel(property.areaSqft),
    TRUST_HTML: raw(renderTrustHtml(property.permitNumber)),
    INSIGHT_HTML: raw(renderForeInsightHtml(insightFacts)),
    DESCRIPTION: property.description,
    AMENITIES_HTML: raw(renderAmenitiesHtml(property.amenities)),
    AGENT_HTML: raw(renderAgentSectionHtml(property.agentName)),
    SIMILAR_HTML: raw(renderSimilarPropertiesHtml(similar)),
    MAIN_IMAGE: property.images[0] || 'https://placehold.co/1200x800?text=FORE',
    GALLERY_THUMB: property.images.map((url, index) => ({ url, alt: property.name, index })),
    GALLERY_JSON: raw(galleryJson),
  });

  const issues = validateGeneratedPages([
    { pageType: 'property', outputPath: canonicalUrl, title, description, jsonLd: listingSchema },
  ]);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length) {
    throw new Error(`Generated page failed validation: ${errors.map((e) => e.message).join('; ')}`);
  }

  return {
    property,
    title,
    description,
    canonicalUrl,
    outputRelativePath: path.join('properties', property.areaSlug, property.slug, 'index.html'),
    html,
  };
}

async function main() {
  logger.info('Fetching one published property from Supabase...');
  const [row] = await fetchPublishedProperties({ limit: 1 });
  if (!row) {
    throw new Error('No published property found in secondary_listings.');
  }

  const { html, outputRelativePath, canonicalUrl } = buildPropertyPage(row);

  const outputPath = path.join(REPO_ROOT, outputRelativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');

  logger.info(`Wrote ${outputRelativePath} (${canonicalUrl})`);
}

// Only run when executed directly (`node generator/generate-property-page.mjs`),
// not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logger.error(err.stack || err.message);
    process.exitCode = 1;
  });
}
