/**
 * redirect-lookup.test.mjs
 * Run: node --test redirect-lookup.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRedirectIndex, resolveRedirectDestination } from './redirect-lookup.mjs';

function makeManifest(redirects) {
  return {
    generated_at: '2026-01-01T00:00:00.000Z',
    legacy_pattern: '/property-detail.html?id={id}&type=secondary',
    total: redirects.length,
    redirects,
  };
}

const SAMPLE_MANIFEST = makeManifest([
  { id: '8196af1a-30be-4f18-ae76-956086bcee69', legacy_url: '/property-detail.html?id=8196af1a-30be-4f18-ae76-956086bcee69&type=secondary', canonical_url: 'https://www.fairopportunity.ae/properties/azizi-riviera-29/furnished-studio-1-cheque-vacant-bcee69/' },
  { id: '646ee059-2933-4f27-84fe-b185380a7eae', legacy_url: '/property-detail.html?id=646ee059-2933-4f27-84fe-b185380a7eae&type=secondary', canonical_url: 'https://www.fairopportunity.ae/properties/lum1nar-tower-3/negotiable-studio-lum1nar-tower-3-jvt-0a7eae/' },
]);

test('buildRedirectIndex: maps every entry\'s id to its canonical_url', () => {
  const index = buildRedirectIndex(SAMPLE_MANIFEST);
  assert.equal(index.size, 2);
  assert.equal(
    index.get('8196af1a-30be-4f18-ae76-956086bcee69'),
    'https://www.fairopportunity.ae/properties/azizi-riviera-29/furnished-studio-1-cheque-vacant-bcee69/'
  );
});

test('buildRedirectIndex: empty/malformed manifest yields an empty index, not a throw', () => {
  assert.equal(buildRedirectIndex({}).size, 0);
  assert.equal(buildRedirectIndex(null).size, 0);
  assert.equal(buildRedirectIndex({ redirects: null }).size, 0);
});

test('resolveRedirectDestination: existing secondary id redirects to exactly the manifest\'s canonical_url', () => {
  const index = buildRedirectIndex(SAMPLE_MANIFEST);
  const requestUrl = new URL('https://www.fairopportunity.ae/property-detail.html?id=8196af1a-30be-4f18-ae76-956086bcee69&type=secondary');

  const destination = resolveRedirectDestination(requestUrl, index);

  assert.equal(destination, 'https://www.fairopportunity.ae/properties/azizi-riviera-29/furnished-studio-1-cheque-vacant-bcee69/');
});

test('resolveRedirectDestination: unknown id falls through (null)', () => {
  const index = buildRedirectIndex(SAMPLE_MANIFEST);
  const requestUrl = new URL('https://www.fairopportunity.ae/property-detail.html?id=00000000-0000-0000-0000-000000000000&type=secondary');

  assert.equal(resolveRedirectDestination(requestUrl, index), null);
});

test('resolveRedirectDestination: off-plan URL (no &type=secondary) falls through (null)', () => {
  const index = buildRedirectIndex(SAMPLE_MANIFEST);
  const requestUrl = new URL('https://www.fairopportunity.ae/property-detail.html?id=8196af1a-30be-4f18-ae76-956086bcee69');

  assert.equal(resolveRedirectDestination(requestUrl, index), null);
});

test('resolveRedirectDestination: malformed URL (missing id, empty id, type but no id) falls through (null)', () => {
  const index = buildRedirectIndex(SAMPLE_MANIFEST);

  assert.equal(resolveRedirectDestination(new URL('https://www.fairopportunity.ae/property-detail.html'), index), null);
  assert.equal(resolveRedirectDestination(new URL('https://www.fairopportunity.ae/property-detail.html?type=secondary'), index), null);
  assert.equal(resolveRedirectDestination(new URL('https://www.fairopportunity.ae/property-detail.html?id=&type=secondary'), index), null);
});

test('resolveRedirectDestination: preserves unrelated query params on the destination, drops id/type', () => {
  const index = buildRedirectIndex(SAMPLE_MANIFEST);
  const requestUrl = new URL(
    'https://www.fairopportunity.ae/property-detail.html?id=8196af1a-30be-4f18-ae76-956086bcee69&type=secondary&utm_source=fb&utm_campaign=spring'
  );

  const destination = new URL(resolveRedirectDestination(requestUrl, index));

  assert.equal(destination.origin + destination.pathname, 'https://www.fairopportunity.ae/properties/azizi-riviera-29/furnished-studio-1-cheque-vacant-bcee69/');
  assert.equal(destination.searchParams.get('utm_source'), 'fb');
  assert.equal(destination.searchParams.get('utm_campaign'), 'spring');
  assert.equal(destination.searchParams.has('id'), false);
  assert.equal(destination.searchParams.has('type'), false);
});

test('resolveRedirectDestination: two different known ids each resolve to their own distinct canonical_url', () => {
  const index = buildRedirectIndex(SAMPLE_MANIFEST);

  const a = resolveRedirectDestination(
    new URL('https://www.fairopportunity.ae/property-detail.html?id=8196af1a-30be-4f18-ae76-956086bcee69&type=secondary'),
    index
  );
  const b = resolveRedirectDestination(
    new URL('https://www.fairopportunity.ae/property-detail.html?id=646ee059-2933-4f27-84fe-b185380a7eae&type=secondary'),
    index
  );

  assert.notEqual(a, b);
  assert.match(a, /azizi-riviera-29/);
  assert.match(b, /lum1nar-tower-3/);
});
