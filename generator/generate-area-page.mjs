/**
 * generator/generate-area-page.mjs
 * First Area page proof: fetch all published secondary_listings, aggregate
 * them by area (reusing normalize-property.mjs's Property model — no
 * duplicated parsing logic), and generate one static Area page for the
 * area with the most listings. Standalone script — not wired into
 * build.mjs/vercel.json. Does not touch offplan_listings.
 *   node generator/generate-area-page.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchPublishedProperties } from './lib/supabase.mjs';
import { normalizeSecondaryListing } from './lib/normalize-property.mjs';
import { groupPropertiesByArea, getAreaAggregate } from './lib/aggregate-area.mjs';
import { buildAreaEntity } from './lib/normalize-area.mjs';
import { renderTemplate, raw } from './lib/template-engine.mjs';
import { generateTitle, generateDescription } from './lib/meta.mjs';
import { buildPlaceSchema, buildBreadcrumbSchema, toJsonLdScriptTag } from './lib/schema.mjs';
import { validateGeneratedPages } from './lib/validate.mjs';
import { readRepoFile, extractStyleBlocks, rewriteRootRelativeUrls } from './lib/page-assets.mjs';
import { createLogger } from './lib/logger.mjs';
import { REPO_ROOT, GENERATOR_ROOT, config } from './config.mjs';

const logger = createLogger('generate-area-page');

function formatMoney(value) {
  return `AED ${Math.round(value).toLocaleString('en-US')}`;
}

function priceRangeLabel(min, max) {
  if (min == null || max == null) return 'Price on request';
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
}

/**
 * Pure page-building logic: normalized properties + a chosen area slug in,
 * rendered HTML out. No network or filesystem writes — safe to unit test.
 * @param {Array<object>} properties Normalized Property records (normalize-property.mjs).
 * @param {string} areaSlug
 * @returns {{area: object, title: string, description: string, canonicalUrl: string, outputRelativePath: string, html: string}}
 */
export function buildAreaPage(properties, areaSlug) {
  const groups = groupPropertiesByArea(properties);
  const aggregate = getAreaAggregate(groups, areaSlug);
  const area = buildAreaEntity(aggregate);

  const title = generateTitle('area', area);
  const description = generateDescription('area', area);
  const canonicalUrl = `${config.siteUrl}/areas/${area.slug}/`;

  const placeSchema = buildPlaceSchema(area);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: `${config.siteUrl}/` },
    { name: 'Properties', url: `${config.siteUrl}/properties.html` },
    { name: area.name, url: canonicalUrl },
  ]);

  const pageStyles = extractStyleBlocks(readRepoFile('properties.html'));
  const nav = rewriteRootRelativeUrls(readRepoFile('components/nav.html'));
  const footer = rewriteRootRelativeUrls(readRepoFile('components/footer.html'));
  const whatsapp = rewriteRootRelativeUrls(readRepoFile('components/whatsapp.html'));

  const areaProperties = properties.filter((p) => p.areaSlug === areaSlug);

  const templateHtml = fs.readFileSync(path.join(GENERATOR_ROOT, 'templates', 'area.template.html'), 'utf8');

  const html = renderTemplate(templateHtml, {
    TITLE: title,
    META_DESCRIPTION: description,
    CANONICAL_URL: canonicalUrl,
    JSONLD: raw(toJsonLdScriptTag([placeSchema, breadcrumbSchema])),
    PAGE_STYLES: raw(pageStyles),
    NAV: raw(nav),
    FOOTER: raw(footer),
    WHATSAPP: raw(whatsapp),
    AREA_NAME: area.name,
    INTRO_COPY: area.introCopy,
    LISTING_COUNT_LABEL: `${area.listingCount} propert${area.listingCount === 1 ? 'y' : 'ies'}`,
    PRICE_RANGE_LABEL: priceRangeLabel(area.priceMin, area.priceMax),
    PROPERTY_TYPES_LABEL: area.propertyTypes.join(', ') || 'Various',
    PROPERTY_CARD: areaProperties.map((p) => ({
      url: `${config.siteUrl}/properties/${p.areaSlug}/${p.slug}/`,
      image: p.images[0] || 'https://placehold.co/600x400?text=FORE',
      name: p.name,
      price: p.priceAed ? formatMoney(p.priceAed) : 'Price on request',
    })),
  });

  const issues = validateGeneratedPages([
    { pageType: 'area', outputPath: canonicalUrl, title, description, jsonLd: placeSchema, entity: area },
  ]);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length) {
    throw new Error(`Generated area page failed validation: ${errors.map((e) => e.message).join('; ')}`);
  }

  return {
    area,
    title,
    description,
    canonicalUrl,
    outputRelativePath: path.join('areas', area.slug, 'index.html'),
    html,
  };
}

async function main() {
  logger.info('Fetching all published secondary_listings...');
  const rows = await fetchPublishedProperties();

  const properties = rows
    .map((row) => {
      try {
        return normalizeSecondaryListing(row);
      } catch (err) {
        logger.warn(`Skipping row ${row?.id}: ${err.message}`);
        return null;
      }
    })
    .filter(Boolean);

  const groups = groupPropertiesByArea(properties);
  if (groups.size === 0) {
    throw new Error('No areas found among published listings.');
  }

  const [topArea] = [...groups.values()].sort((a, b) => b.listingCount - a.listingCount);
  logger.info(`Selected area "${topArea.areaName}" (${topArea.listingCount} listing(s)) — most listings among ${groups.size} area(s).`);

  const result = buildAreaPage(properties, topArea.areaSlug);

  const outputPath = path.join(REPO_ROOT, result.outputRelativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.html, 'utf8');

  logger.info(`Wrote ${result.outputRelativePath} (${result.canonicalUrl})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logger.error(err.stack || err.message);
    process.exitCode = 1;
  });
}
