import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSimilarProperties, renderSimilarPropertiesHtml } from './similar-properties.mjs';

function summary(overrides = {}) {
  return {
    id: 1,
    areaSlug: 'jvc',
    propertyType: 'Apartment',
    name: 'Unit',
    areaName: 'JVC',
    priceAed: 1000000,
    offeringType: 'sale',
    image: 'https://example.com/a.jpg',
    canonicalUrl: 'https://fairopportunityrealestate.com/properties/jvc/unit-1/',
    ...overrides,
  };
}

test('pickSimilarProperties: excludes the current listing itself', () => {
  const current = summary({ id: 1 });
  const result = pickSimilarProperties(current, [summary({ id: 1 }), summary({ id: 2 })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
});

test('pickSimilarProperties: prefers same area over same property type', () => {
  const current = summary({ id: 1, areaSlug: 'jvc', propertyType: 'Apartment' });
  const candidates = [
    summary({ id: 2, areaSlug: 'marina', propertyType: 'Apartment' }), // same type, different area
    summary({ id: 3, areaSlug: 'jvc', propertyType: 'Villa' }), // same area, different type
  ];
  const result = pickSimilarProperties(current, candidates);
  assert.equal(result[0].id, 3); // same-area candidate ranked first
  assert.equal(result[1].id, 2);
});

test('pickSimilarProperties: respects the limit', () => {
  const current = summary({ id: 1, areaSlug: 'jvc' });
  const candidates = [2, 3, 4, 5].map((id) => summary({ id, areaSlug: 'jvc' }));
  const result = pickSimilarProperties(current, candidates, { limit: 2 });
  assert.equal(result.length, 2);
});

test('pickSimilarProperties: deterministic order, no randomization', () => {
  const current = summary({ id: 1, areaSlug: 'jvc' });
  const candidates = [2, 3, 4].map((id) => summary({ id, areaSlug: 'jvc' }));
  const first = pickSimilarProperties(current, candidates);
  const second = pickSimilarProperties(current, candidates);
  assert.deepEqual(first.map((p) => p.id), second.map((p) => p.id));
});

test('renderSimilarPropertiesHtml: empty when there are no similar listings', () => {
  assert.equal(renderSimilarPropertiesHtml([]), '');
});

test('renderSimilarPropertiesHtml: renders a card per listing with escaped content', () => {
  const html = renderSimilarPropertiesHtml([summary({ name: '<b>Unit</b>' })]);
  assert.match(html, /Similar Properties/);
  assert.match(html, /&lt;b&gt;Unit&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Unit<\/b>/);
});

test('renderSimilarPropertiesHtml: formats rent pricing with a "/ year" suffix', () => {
  const html = renderSimilarPropertiesHtml([summary({ priceAed: 120000, offeringType: 'rent' })]);
  assert.match(html, /AED 120,000 \/ year/);
});
