/**
 * generator/build-lifecycle.test.mjs
 * Integration-style test for the cleanup -> regenerate lifecycle: proves
 * that wiping the properties output directory before running runBatch()
 * removes stale pages left by listings that no longer appear in the
 * fetched dataset, and that a normal run recreates the directory from
 * scratch. Uses a real temp directory (no mocks) but never touches the
 * real REPO_ROOT/properties output.
 * Run: node --test generator/build-lifecycle.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanPropertiesOutputDir } from './lib/output-cleanup.mjs';
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

function listAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true }).filter((entry) => fs.statSync(path.join(dir, entry)).isFile());
}

function writePageInto(dir) {
  return (result) => {
    const outputPath = path.join(dir, result.outputRelativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.html, 'utf8');
  };
}

test('lifecycle: a stale page from a listing no longer in the dataset is gone after cleanup + rebuild', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fore-ssg-lifecycle-'));

  // Simulate a previous build that generated a listing which has since
  // been deleted/unpublished in Supabase.
  const staleListingDir = path.join(outputDir, 'dubai-marina', 'old-deleted-listing-99');
  fs.mkdirSync(staleListingDir, { recursive: true });
  fs.writeFileSync(path.join(staleListingDir, 'index.html'), '<html>stale</html>', 'utf8');
  assert.equal(listAllFiles(outputDir).length, 1);

  // Current dataset no longer includes that listing.
  const currentRows = [makeRow({ id: 1 }), makeRow({ id: 2, name: 'Another Unit' })];

  cleanPropertiesOutputDir(outputDir);
  const report = runBatch(currentRows, { writePage: writePageInto(outputDir) });

  assert.equal(report.succeeded, 2);
  const filesAfter = listAllFiles(outputDir);
  assert.equal(filesAfter.length, 2, 'only the two current listings should be present');
  assert.equal(
    filesAfter.some((f) => f.includes('old-deleted-listing-99')),
    false,
    'the stale listing directory must not survive the rebuild'
  );

  fs.rmSync(outputDir, { recursive: true, force: true });
});

test('lifecycle: successful generation recreates the output directory correctly from an empty state', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fore-ssg-lifecycle-'));
  cleanPropertiesOutputDir(outputDir); // directory doesn't exist yet — no-op
  assert.equal(fs.existsSync(outputDir), false);

  const report = runBatch([makeRow({ id: 1 })], { writePage: writePageInto(outputDir) });

  assert.equal(report.succeeded, 1);
  assert.equal(fs.existsSync(outputDir), true);
  assert.equal(listAllFiles(outputDir).length, 1);

  fs.rmSync(outputDir, { recursive: true, force: true });
});
