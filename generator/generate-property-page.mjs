/**
 * generator/generate-property-page.mjs
 * First end-to-end proof: fetch one published property, normalize it,
 * render it through the template engine, and write a static HTML file.
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
import { readRepoFile, extractStyleBlocks, rewriteRootRelativeUrls } from './lib/page-assets.mjs';
import { createLogger } from './lib/logger.mjs';
import { REPO_ROOT, GENERATOR_ROOT, config } from './config.mjs';

const logger = createLogger('generate-property-page');

function formatPriceLabel(priceAed) {
  return priceAed ? `AED ${Math.round(priceAed).toLocaleString('en-US')}` : 'Price on request';
}

function bedroomsLabel(bedrooms) {
  if (bedrooms === 0) return 'Studio';
  if (!bedrooms) return '';
  return `${bedrooms} Bedroom${bedrooms > 1 ? 's' : ''}`;
}

function bathroomsLabel(bathrooms) {
  return bathrooms ? `${bathrooms} Bathroom${bathrooms > 1 ? 's' : ''}` : '';
}

function areaSqftLabel(areaSqft) {
  return areaSqft ? `${Math.round(areaSqft).toLocaleString('en-US')} sq ft` : '';
}

/**
 * Pure page-building logic: raw Supabase row in, rendered HTML out. No
 * network or filesystem writes — safe to unit test directly.
 * @param {Record<string, unknown>} row Raw `secondary_listings` row.
 * @returns {{property: object, title: string, description: string, canonicalUrl: string, outputRelativePath: string, html: string}}
 */
export function buildPropertyPage(row) {
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

  const pageStyles = extractStyleBlocks(readRepoFile('property-detail.html'));
  const nav = rewriteRootRelativeUrls(readRepoFile('components/nav.html'));
  const footer = rewriteRootRelativeUrls(readRepoFile('components/footer.html'));
  const whatsapp = rewriteRootRelativeUrls(readRepoFile('components/whatsapp.html'));

  const templateHtml = fs.readFileSync(
    path.join(GENERATOR_ROOT, 'templates', 'property.template.html'),
    'utf8'
  );

  const html = renderTemplate(templateHtml, {
    TITLE: title,
    META_DESCRIPTION: description,
    CANONICAL_URL: canonicalUrl,
    OG_IMAGE: property.images[0] || `${config.siteUrl}/brand_assets/og-image.jpg`,
    JSONLD: raw(toJsonLdScriptTag([listingSchema, breadcrumbSchema])),
    PAGE_STYLES: raw(pageStyles),
    NAV: raw(nav),
    FOOTER: raw(footer),
    WHATSAPP: raw(whatsapp),
    LISTING_NAME: property.name,
    LISTING_ID: property.id,
    AREA_NAME: property.areaName,
    CITY: property.city,
    PRICE_FORMATTED: formatPriceLabel(property.priceAed),
    BEDROOMS_LABEL: bedroomsLabel(property.bedrooms),
    BATHROOMS_LABEL: bathroomsLabel(property.bathrooms),
    AREA_SQFT_LABEL: areaSqftLabel(property.areaSqft),
    DESCRIPTION: property.description,
    MAIN_IMAGE: property.images[0] || 'https://placehold.co/1200x800?text=FORE',
    GALLERY_THUMB: property.images.map((url) => ({ url, alt: property.name })),
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
