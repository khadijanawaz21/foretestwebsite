/**
 * generator/generate-all-secondary-listings.test.mjs
 * Run: node --test generator/generate-all-secondary-listings.test.mjs
 * Tests runBatch() with synthetic rows and an in-memory writer — no
 * network access or filesystem writes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBatch } from './generate-all-secondary-listings.mjs';

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

test('runBatch: generates a page per row and writes via injected writer', () => {
  const written = [];
  const rows = [makeRow({ id: 1 }), makeRow({ id: 2, name: 'Another Unit', location: 'JVC' })];
  const report = runBatch(rows, { writePage: (r) => written.push(r.outputRelativePath) });

  assert.equal(report.totalFound, 2);
  assert.equal(report.succeeded, 2);
  assert.equal(report.failed, 0);
  assert.equal(written.length, 2);
});

test('runBatch: continues past a failing row', () => {
  const rows = [makeRow({ id: 1 }), { id: 2 /* missing name/building_name */ }, makeRow({ id: 3, name: 'Third Unit' })];
  const report = runBatch(rows, { writePage: () => {} });

  assert.equal(report.totalFound, 3);
  assert.equal(report.succeeded, 2);
  assert.equal(report.failed, 1);
  assert.equal(report.failures[0].id, 2);
});

test('runBatch: failure record has no slug when normalization itself is what failed', () => {
  const rows = [{ id: 2 /* missing name/building_name */ }];
  const report = runBatch(rows, { writePage: () => {} });
  assert.equal(report.failures[0].slug, undefined);
});

test('runBatch: failure record captures the slug when normalization succeeded but a later step failed', () => {
  const rows = [makeRow({ id: 4, price: null })]; // normalizes fine; schema builder requires priceAed
  const report = runBatch(rows, { writePage: () => {} });
  assert.equal(report.failed, 1);
  assert.equal(report.failures[0].id, 4);
  assert.ok(report.failures[0].slug, 'expected a slug to have been captured');
  assert.match(report.failures[0].reason, /priceAed/);
});

test('runBatch: succeededPages carries the id + canonical URL of every generated page, excluding failures', () => {
  const rows = [makeRow({ id: 1 }), { id: 2 /* missing name/building_name -> fails */ }, makeRow({ id: 3, name: 'Third Unit' })];
  const report = runBatch(rows, { writePage: () => {} });

  assert.equal(report.succeededPages.length, 2);
  assert.ok(report.succeededPages.every((p) => typeof p.canonicalUrl === 'string' && p.canonicalUrl.length > 0));
  assert.deepEqual(
    report.succeededPages.map((p) => p.id).sort(),
    [1, 3]
  );
  assert.equal(report.succeededPages.some((p) => p.id === 2), false);
});

test('runBatch: detects duplicate generated titles and descriptions', () => {
  const rows = [
    makeRow({ id: 1 }),
    makeRow({ id: 2 }), // identical bedrooms/type/building/area -> identical title+description
  ];
  const report = runBatch(rows, { writePage: () => {} });

  assert.equal(report.succeeded, 2);
  assert.equal(report.duplicateTitles.length, 1);
  assert.equal(report.duplicateDescriptions.length, 1);
});

test('runBatch: reports zero listings without throwing', () => {
  const report = runBatch([], { writePage: () => {} });
  assert.equal(report.totalFound, 0);
  assert.equal(report.succeeded, 0);
  assert.equal(report.failed, 0);
  assert.equal(typeof report.durationMs, 'number');
});
