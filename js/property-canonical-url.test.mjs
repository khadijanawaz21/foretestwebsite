/**
 * js/property-canonical-url.test.mjs
 * Runs under Node (no DOM/browser needed — this module has no browser
 * API dependency, only pure functions reused from the generator).
 * Run: node --test js/property-canonical-url.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secondaryListingCanonicalPath } from './property-canonical-url.mjs';
import { buildPropertyPage } from '../generator/generate-property-page.mjs';

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

test('secondaryListingCanonicalPath: matches the path the generator actually publishes the page at', () => {
  const row = makeRow({ id: 42, name: 'Beach Vista Tower 2 Unit 2701', location: 'Emaar Beachfront' });

  const generatedPage = buildPropertyPage(row);
  const frontendPath = secondaryListingCanonicalPath(row);

  // canonicalUrl is `${siteUrl}${path}` — strip the site origin to compare paths.
  const generatedPath = generatedPage.canonicalUrl.replace(process.env.SITE_BASE_URL, '');
  assert.equal(frontendPath, generatedPath);
  assert.match(frontendPath, /^\/properties\/emaar-beachfront\/beach-vista-tower-2-unit-2701-/);
});

test('secondaryListingCanonicalPath: every well-formed row resolves to a canonical path, never the legacy pattern', () => {
  const rows = [
    makeRow({ id: 1, name: 'Unit A', location: 'JVC' }),
    makeRow({ id: 2, name: 'Unit B', location: 'Downtown Dubai' }),
    makeRow({ id: 3, name: 'Unit C', location: 'Business Bay' }),
  ];

  for (const row of rows) {
    const path = secondaryListingCanonicalPath(row);
    assert.ok(path, `expected a canonical path for row ${row.id}`);
    assert.match(path, /^\/properties\//);
    assert.doesNotMatch(path, /property-detail\.html/);
  }
});

test('secondaryListingCanonicalPath: returns null (not a broken URL) when the row can\'t be normalized', () => {
  const path = secondaryListingCanonicalPath({ id: 99 /* missing name/building_name */ });
  assert.equal(path, null);
});
