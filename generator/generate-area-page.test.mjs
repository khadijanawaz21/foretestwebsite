/**
 * generator/generate-area-page.test.mjs
 * Run: node --test generator/generate-area-page.test.mjs
 * Tests aggregation + pure page-building logic against synthetic
 * normalized properties — no network access required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSecondaryListing } from './lib/normalize-property.mjs';
import { groupPropertiesByArea, getAreaAggregate } from './lib/aggregate-area.mjs';
import { buildAreaEntity } from './lib/normalize-area.mjs';
import { buildAreaPage } from './generate-area-page.mjs';

process.env.SITE_BASE_URL = 'https://fairopportunityrealestate.com';

function makeRow(overrides = {}) {
  return {
    id: 1,
    name: 'Sample Unit',
    building_name: 'Sample Tower',
    location: 'Dubai Marina',
    city: 'Dubai',
    price: 1500000,
    bedrooms: '2',
    bathrooms: 2,
    area_sqft: 1000,
    property_type: 'Apartment',
    offering_type: 'sale',
    description: 'A well-appointed apartment in a prime location with excellent amenities nearby.',
    image_main: 'https://example.com/main.jpg',
    images: '',
    ...overrides,
  };
}

const marinaRows = [
  makeRow({ id: 1, price: 1200000, property_type: 'Apartment' }),
  makeRow({ id: 2, price: 2400000, property_type: 'Penthouse' }),
];
const jvcRows = [makeRow({ id: 3, location: 'JVC', price: 900000, property_type: 'Apartment' })];

test('groupPropertiesByArea: aggregates count, price range, and property types', () => {
  const properties = [...marinaRows, ...jvcRows].map(normalizeSecondaryListing);
  const groups = groupPropertiesByArea(properties);

  const marina = getAreaAggregate(groups, 'dubai-marina');
  assert.equal(marina.listingCount, 2);
  assert.equal(marina.priceMin, 1200000);
  assert.equal(marina.priceMax, 2400000);
  assert.deepEqual(marina.propertyTypes, ['Apartment', 'Penthouse']);

  const jvc = getAreaAggregate(groups, 'jvc');
  assert.equal(jvc.listingCount, 1);
});

test('getAreaAggregate: throws for an unknown area slug', () => {
  const properties = marinaRows.map(normalizeSecondaryListing);
  const groups = groupPropertiesByArea(properties);
  assert.throws(() => getAreaAggregate(groups, 'nonexistent-area'));
});

test('buildAreaEntity: produces a non-empty interim introCopy from real stats', () => {
  const properties = marinaRows.map(normalizeSecondaryListing);
  const groups = groupPropertiesByArea(properties);
  const area = buildAreaEntity(getAreaAggregate(groups, 'dubai-marina'));
  assert.match(area.introCopy, /Dubai Marina is a Dubai real estate community currently listing 2 properties/);
});

test('buildAreaPage: renders SEO title, meta description, JSON-LD, breadcrumb, and stats', () => {
  const properties = [...marinaRows, ...jvcRows].map(normalizeSecondaryListing);
  const result = buildAreaPage(properties, 'dubai-marina');

  assert.match(result.title, /Dubai Marina.*FORE/);
  assert.ok(result.description.length > 0);
  assert.match(result.html, /"@type":"Place"/);
  assert.match(result.html, /"@type":"BreadcrumbList"/);
  assert.match(result.html, />2 properties</);
  assert.match(result.html, />AED 1,200,000 - AED 2,400,000</);
  assert.match(result.html, />Apartment, Penthouse</);
  assert.doesNotMatch(result.html, /<!--SSG:/); // no leftover unrendered markers
  assert.equal(result.outputRelativePath, 'areas/dubai-marina/index.html');
});

test('buildAreaPage: only includes property cards for the selected area', () => {
  const properties = [...marinaRows, ...jvcRows].map(normalizeSecondaryListing);
  const result = buildAreaPage(properties, 'dubai-marina');
  assert.equal((result.html.match(/class="prop-card"/g) || []).length, 2);
});
