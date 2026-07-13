/**
 * generator/lib/sitemap.test.mjs
 * Run: node --test generator/lib/sitemap.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSitemapEntries, buildSitemapXml, STATIC_PAGES } from './sitemap.mjs';

process.env.SITE_BASE_URL = 'https://fairopportunityrealestate.com';

function makeReport(succeededPages = []) {
  return { succeededPages };
}

test('buildSitemapEntries: includes every static page exactly once', () => {
  const entries = buildSitemapEntries(makeReport([]));
  const urls = entries.map((e) => e.url);

  assert.equal(urls.length, STATIC_PAGES.length);
  assert.equal(new Set(urls).size, urls.length, 'static pages must appear only once');
  assert.ok(urls.includes('https://fairopportunityrealestate.com/'));
  assert.ok(urls.includes('https://fairopportunityrealestate.com/properties.html'));
});

test('buildSitemapEntries: includes every successfully generated property URL', () => {
  const report = makeReport([
    { canonicalUrl: 'https://fairopportunityrealestate.com/properties/dubai-marina/unit-1/' },
    { canonicalUrl: 'https://fairopportunityrealestate.com/properties/jvc/unit-2/' },
  ]);
  const entries = buildSitemapEntries(report);
  const urls = entries.map((e) => e.url);

  assert.ok(urls.includes('https://fairopportunityrealestate.com/properties/dubai-marina/unit-1/'));
  assert.ok(urls.includes('https://fairopportunityrealestate.com/properties/jvc/unit-2/'));
  assert.equal(urls.length, STATIC_PAGES.length + 2);
});

test('buildSitemapEntries: excludes listings that failed or were never in succeededPages', () => {
  // runBatch only ever puts genuinely successful pages into succeededPages —
  // a report with failures elsewhere must not leak their URLs in here.
  const report = {
    succeededPages: [{ canonicalUrl: 'https://fairopportunityrealestate.com/properties/dubai-marina/unit-1/' }],
    failed: 1,
    failures: [{ id: 99, slug: 'unit-99', reason: 'boom' }],
  };
  const entries = buildSitemapEntries(report);
  const urls = entries.map((e) => e.url);

  assert.equal(urls.filter((u) => u.includes('unit-99')).length, 0);
  assert.equal(urls.length, STATIC_PAGES.length + 1);
});

test('buildSitemapEntries: does not emit duplicate URLs even if succeededPages has a repeat', () => {
  const report = makeReport([
    { canonicalUrl: 'https://fairopportunityrealestate.com/properties/dubai-marina/unit-1/' },
    { canonicalUrl: 'https://fairopportunityrealestate.com/properties/dubai-marina/unit-1/' },
  ]);
  const entries = buildSitemapEntries(report);
  const urls = entries.map((e) => e.url);

  assert.equal(urls.filter((u) => u === 'https://fairopportunityrealestate.com/properties/dubai-marina/unit-1/').length, 1);
  assert.equal(urls.length, STATIC_PAGES.length + 1);
});

test('buildSitemapXml: renders a <url><loc> entry for every input entry, no duplicates', () => {
  const xml = buildSitemapXml([
    { url: 'https://example.com/', changefreq: 'daily', priority: 1.0 },
    { url: 'https://example.com/properties/a/b/', changefreq: 'daily', priority: 0.8 },
  ]);

  assert.match(xml, /<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<loc>/g) || []).length, 2);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/properties\/a\/b\/<\/loc>/);
});
