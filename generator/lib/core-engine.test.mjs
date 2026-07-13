/**
 * generator/lib/core-engine.test.mjs
 * Run: node --test generator/lib/core-engine.test.mjs
 * Uses Node's built-in test runner — no external dependency.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slugify.mjs';
import { renderTemplate, raw, extractRepeatBlock } from './template-engine.mjs';
import { generateTitle, generateDescription } from './meta.mjs';
import {
  buildOrganizationSchema,
  buildRealEstateListingSchema,
  buildBreadcrumbSchema,
  buildFAQSchema,
} from './schema.mjs';
import { validateGeneratedPages } from './validate.mjs';

process.env.SITE_BASE_URL = 'https://fairopportunityrealestate.com';

test('slugify: basic and accented input', () => {
  assert.equal(slugify('Beach Vista Tower 2'), 'beach-vista-tower-2');
  assert.equal(slugify('Café de Paris'), 'cafe-de-paris');
  assert.equal(slugify('Dubai Marina', { suffix: 'A1512' }), 'dubai-marina-a1512');
});

test('slugify: rejects empty/unsluggable input', () => {
  assert.throws(() => slugify(''));
  assert.throws(() => slugify('!!!'));
});

test('slugify: truncates long input at a whole segment', () => {
  const slug = slugify('a'.repeat(100), { maxLength: 10 });
  assert.ok(slug.length <= 10);
});

test('template-engine: token substitution escapes by default', () => {
  const out = renderTemplate('<h1><!--SSG:TITLE--></h1>', { TITLE: 'Tom & Jerry' });
  assert.equal(out, '<h1>Tom &amp; Jerry</h1>');
});

test('template-engine: raw() bypasses escaping', () => {
  const out = renderTemplate('<head><!--SSG:JSONLD--></head>', { JSONLD: raw('<script>1</script>') });
  assert.equal(out, '<head><script>1</script></head>');
});

test('template-engine: repeat blocks expand per item', () => {
  const tpl = '<ul><!--SSG:REPEAT:ITEMS--><li><!--SSG:ITEM.name--></li><!--SSG:/REPEAT--></ul>';
  const out = renderTemplate(tpl, { ITEMS: [{ name: 'A' }, { name: 'B' }] });
  assert.equal(out, '<ul><li>A</li><li>B</li></ul>');
});

test('template-engine: missing marker throws', () => {
  assert.throws(() => renderTemplate('<!--SSG:MISSING-->', {}));
});

test('template-engine: unterminated repeat block throws', () => {
  assert.throws(() => extractRepeatBlock('<!--SSG:REPEAT:X-->no close', 'X'));
});

test('meta: property title and description', () => {
  const entity = {
    bedrooms: 2,
    propertyType: 'Apartment',
    offeringType: 'sale',
    buildingName: 'Beach Vista Tower 2',
    areaName: 'Dubai Marina',
    priceAed: 1850000,
    areaSqft: 1120,
    description: 'A bright two-bedroom apartment with marina views and premium finishes throughout.',
  };
  assert.equal(generateTitle('property', entity), '2BR Apartment for Sale in Beach Vista Tower 2, Dubai Marina | FORE');
  assert.match(generateDescription('property', entity), /^From AED 1,850,000, 1,120 sq ft\./);
});

test('meta: override takes precedence', () => {
  const entity = { propertyType: 'Apartment', buildingName: 'X', areaName: 'Y', metaTitleOverride: 'Custom Title' };
  assert.equal(generateTitle('property', entity), 'Custom Title');
});

test('meta: missing required field throws', () => {
  assert.throws(() => generateTitle('property', {}));
});

test('schema: organization schema shape', () => {
  const schema = buildOrganizationSchema();
  assert.equal(schema['@type'][0], 'Organization');
  assert.equal(schema.url, 'https://fairopportunityrealestate.com');
});

test('schema: real estate listing requires core fields', () => {
  assert.throws(() => buildRealEstateListingSchema({}));
  const schema = buildRealEstateListingSchema({
    name: 'Unit A1512',
    slug: 'unit-a1512',
    areaSlug: 'dubai-marina',
    priceAed: 1850000,
    propertyType: 'Apartment',
  });
  assert.equal(schema.offers.price, 1850000);
  assert.equal(schema.url, 'https://fairopportunityrealestate.com/properties/dubai-marina/unit-a1512/');
});

test('schema: breadcrumb and FAQ validation', () => {
  assert.throws(() => buildBreadcrumbSchema([]));
  assert.throws(() => buildFAQSchema([{ question: 'Q' }]));
  const faq = buildFAQSchema([{ question: 'What is escrow?', answer: 'A protected account.' }]);
  assert.equal(faq.mainEntity[0].name, 'What is escrow?');
});

test('validate: flags missing title, duplicate description, missing intro_copy', () => {
  const issues = validateGeneratedPages([
    { pageType: 'property', outputPath: '/a/', title: '', description: 'Same desc' },
    { pageType: 'property', outputPath: '/b/', title: 'B', description: 'Same desc' },
    { pageType: 'area', outputPath: '/c/', title: 'C', description: 'D', entity: {} },
  ]);
  assert.ok(issues.some((i) => i.message.includes('missing a title')));
  assert.ok(issues.some((i) => i.message.includes('Duplicate description')));
  assert.ok(issues.some((i) => i.message.includes('intro_copy')));
});

test('validate: warns on large count swings', () => {
  const issues = validateGeneratedPages(
    [{ pageType: 'property', outputPath: '/a/', title: 'A', description: 'B' }],
    { property: 10 }
  );
  assert.ok(issues.some((i) => i.severity === 'warning' && i.message.includes('changed by')));
});
