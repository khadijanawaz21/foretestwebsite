/**
 * generator/lib/redirects.test.mjs
 * Run: node --test generator/lib/redirects.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRedirectManifest } from './redirects.mjs';

function makeReport(succeededPages) {
  return { succeededPages };
}

test('buildRedirectManifest: contains every generated property', () => {
  const report = makeReport([
    { id: 1, canonicalUrl: 'https://example.com/properties/a/unit-1/' },
    { id: 2, canonicalUrl: 'https://example.com/properties/b/unit-2/' },
    { id: 3, canonicalUrl: 'https://example.com/properties/c/unit-3/' },
  ]);

  const manifest = buildRedirectManifest(report);

  assert.equal(manifest.total, 3);
  assert.equal(manifest.redirects.length, 3);
  assert.deepEqual(
    manifest.redirects.map((r) => r.id).sort(),
    [1, 2, 3]
  );
});

test('buildRedirectManifest: each id maps to its correct legacy and canonical URL', () => {
  const report = makeReport([{ id: 42, canonicalUrl: 'https://example.com/properties/marina/unit-42/' }]);

  const manifest = buildRedirectManifest(report);

  assert.deepEqual(manifest.redirects[0], {
    id: 42,
    legacy_url: '/property-detail.html?id=42&type=secondary',
    canonical_url: 'https://example.com/properties/marina/unit-42/',
  });
});

test('buildRedirectManifest: excludes failed listings (they are simply absent from succeededPages)', () => {
  // runBatch only ever puts genuinely successful pages into succeededPages;
  // a failed listing (id 99) must never appear here.
  const report = makeReport([{ id: 1, canonicalUrl: 'https://example.com/properties/a/unit-1/' }]);

  const manifest = buildRedirectManifest(report);

  assert.equal(manifest.redirects.some((r) => r.id === 99), false);
  assert.equal(manifest.total, 1);
});

test('buildRedirectManifest: duplicate ids collapse to a single entry (first occurrence wins)', () => {
  const report = makeReport([
    { id: 5, canonicalUrl: 'https://example.com/properties/a/first/' },
    { id: 5, canonicalUrl: 'https://example.com/properties/a/second/' },
  ]);

  const manifest = buildRedirectManifest(report);

  assert.equal(manifest.total, 1);
  assert.equal(manifest.redirects.filter((r) => r.id === 5).length, 1);
  assert.equal(manifest.redirects[0].canonical_url, 'https://example.com/properties/a/first/');
});

test('buildRedirectManifest: output ordering is deterministic (sorted by id) regardless of input order', () => {
  const reportA = makeReport([
    { id: 3, canonicalUrl: 'https://example.com/properties/c/unit-3/' },
    { id: 1, canonicalUrl: 'https://example.com/properties/a/unit-1/' },
    { id: 2, canonicalUrl: 'https://example.com/properties/b/unit-2/' },
  ]);
  const reportB = makeReport([
    { id: 1, canonicalUrl: 'https://example.com/properties/a/unit-1/' },
    { id: 2, canonicalUrl: 'https://example.com/properties/b/unit-2/' },
    { id: 3, canonicalUrl: 'https://example.com/properties/c/unit-3/' },
  ]);

  const manifestA = buildRedirectManifest(reportA);
  const manifestB = buildRedirectManifest(reportB);

  assert.deepEqual(
    manifestA.redirects.map((r) => r.id),
    manifestB.redirects.map((r) => r.id)
  );
  assert.deepEqual(
    manifestA.redirects.map((r) => r.id),
    [1, 2, 3]
  );
});
