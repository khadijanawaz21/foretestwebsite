/**
 * generator/generate-property-page.test.mjs
 * Run: node --test generator/generate-property-page.test.mjs
 * Tests the pure page-building logic against a representative sample row —
 * no network access or live Supabase credentials required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSecondaryListing } from './lib/normalize-property.mjs';
import { buildPropertyPage } from './generate-property-page.mjs';

process.env.SITE_BASE_URL = 'https://fairopportunityrealestate.com';

const SAMPLE_ROW = {
  id: 4821,
  name: 'Beach Vista Tower 2 Unit 2701',
  building_name: 'Beach Vista Tower 2',
  location: 'Emaar Beachfront',
  city: 'Dubai',
  price: 1850000,
  bedrooms: '2',
  bathrooms: 2,
  area_sqft: 1120,
  property_type: 'Apartment',
  offering_type: 'sale',
  description:
    'A bright two-bedroom apartment with marina and sea views, premium finishes, and access to a private beach.',
  image_main: 'https://famknekdbtrmxopywgsj.supabase.co/storage/v1/object/public/media/main.jpg',
  images: 'https://example.com/1.jpg, https://example.com/2.jpg',
  handover_date: '2027-06-01',
};

test('normalizeSecondaryListing: maps raw row to normalized model', () => {
  const property = normalizeSecondaryListing(SAMPLE_ROW);
  assert.equal(property.bedrooms, 2);
  assert.equal(property.areaSlug, 'emaar-beachfront');
  assert.match(property.slug, /^beach-vista-tower-2-unit-2701-/);
  assert.equal(property.images.length, 3);
});

test('normalizeSecondaryListing: throws on missing name', () => {
  assert.throws(() => normalizeSecondaryListing({ id: 1 }));
});

test('normalizeSecondaryListing: studio maps to 0 bedrooms', () => {
  const property = normalizeSecondaryListing({ ...SAMPLE_ROW, bedrooms: 'Studio' });
  assert.equal(property.bedrooms, 0);
});

test('buildPropertyPage: produces valid HTML with real title/schema/nav/footer', () => {
  const result = buildPropertyPage(SAMPLE_ROW);
  assert.match(
    result.html,
    /<title>2BR Apartment for Sale in Beach Vista Tower 2, Emaar Beachfront \| FORE<\/title>/
  );
  assert.match(result.html, /application\/ld\+json/);
  assert.match(result.html, /class="nav-brand"/); // real nav.html content inlined
  assert.match(result.html, /RERA Broker No/); // real footer.html content inlined
  assert.doesNotMatch(result.html, /<!--SSG:/); // no leftover unrendered markers
});

test('buildPropertyPage: rewrites root-relative component links to absolute', () => {
  const result = buildPropertyPage(SAMPLE_ROW);
  assert.match(result.html, /href="\/properties\.html"/);
  assert.doesNotMatch(result.html, /href="properties\.html"/);
});

test('buildPropertyPage: output path matches the slug URL scheme', () => {
  const result = buildPropertyPage(SAMPLE_ROW);
  assert.equal(result.outputRelativePath, `properties/emaar-beachfront/${result.property.slug}/index.html`);
});
