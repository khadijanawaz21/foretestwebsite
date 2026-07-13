import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildForeInsightFacts, renderForeInsightHtml } from './editorial-copy.mjs';

test('buildForeInsightFacts: empty when no qualifying verified fields are present', () => {
  const facts = buildForeInsightFacts({ name: 'Unit 101', areaName: 'JVC' });
  assert.deepEqual(facts, []);
});

test('buildForeInsightFacts: building/project context requires both a place name and an area', () => {
  const facts = buildForeInsightFacts({ buildingName: 'Beach Vista Tower 2', areaName: 'Emaar Beachfront', city: 'Dubai' });
  assert.equal(facts.length, 1);
  assert.equal(facts[0].text, 'Part of Beach Vista Tower 2 in Emaar Beachfront, Dubai.');
});

test('buildForeInsightFacts: projectName takes precedence over buildingName', () => {
  const facts = buildForeInsightFacts({ projectName: 'Riviera', buildingName: 'Riviera 29', areaName: 'MBR City' });
  assert.match(facts[0].text, /^Part of Riviera in MBR City/);
});

test('buildForeInsightFacts: completion year only when handoverYear is present', () => {
  const facts = buildForeInsightFacts({ buildingName: 'Tower X', handoverYear: 2021 });
  const completion = facts.find((f) => f.kind === 'completion');
  assert.equal(completion.text, 'Tower X was completed in 2021.');
});

test('buildForeInsightFacts: furnishing status detected from amenities, unfurnished not misread as furnished', () => {
  const unfurnished = buildForeInsightFacts({ amenities: ['Unfurnished', 'Balcony'] });
  assert.equal(unfurnished.find((f) => f.kind === 'furnishing').text, 'Offered unfurnished.');

  const furnished = buildForeInsightFacts({ amenities: ['Furnished', 'Gym'] });
  assert.equal(furnished.find((f) => f.kind === 'furnishing').text, 'Offered furnished.');

  const semi = buildForeInsightFacts({ amenities: ['Semi-Furnished'] });
  assert.equal(semi.find((f) => f.kind === 'furnishing').text, 'Offered semi-furnished.');
});

test('buildForeInsightFacts: amenity highlight fires from a keyword match, in fixed priority order', () => {
  const facts = buildForeInsightFacts({ amenities: ['Balcony', 'Shared Pool', 'Shared Gym', 'Security'] });
  const amenity = facts.find((f) => f.kind === 'amenity');
  assert.equal(amenity.text, 'Includes Shared Pool and Shared Gym.');
});

test('buildForeInsightFacts: amenity highlight falls back to the first listed amenities when no keyword matches', () => {
  const facts = buildForeInsightFacts({ amenities: ['Networked', 'Lobby in Building', 'Dining in Building'] });
  const amenity = facts.find((f) => f.kind === 'amenity');
  assert.equal(amenity.text, 'Includes Networked and Lobby in Building.');
});

test('buildForeInsightFacts: amenity highlight is the only fact for a listing with amenities but nothing else verified', () => {
  const facts = buildForeInsightFacts({ amenities: ['Built-in Wardrobes'] });
  assert.equal(facts.length, 1);
  assert.equal(facts[0].text, 'Includes Built-in Wardrobes.');
});

test('buildForeInsightFacts: caps output at 3 facts even when every rule qualifies', () => {
  const facts = buildForeInsightFacts({
    buildingName: 'Tower X',
    areaName: 'JVC',
    handoverYear: 2022,
    amenities: ['Shared Pool', 'Furnished'],
  });
  assert.ok(facts.length <= 3);
});

test('buildForeInsightFacts: deterministic — same input always yields identical output', () => {
  const property = { buildingName: 'Tower X', areaName: 'JVC', city: 'Dubai', handoverYear: 2022, amenities: ['Furnished'] };
  assert.deepEqual(buildForeInsightFacts(property), buildForeInsightFacts(property));
});

test('renderForeInsightHtml: renders nothing when there are no facts', () => {
  assert.equal(renderForeInsightHtml([]), '');
});

test('renderForeInsightHtml: escapes fact text and labels the section "FORE Insight"', () => {
  const html = renderForeInsightHtml([{ kind: 'context', text: 'Part of <script>alert(1)</script> in JVC.' }]);
  assert.match(html, /FORE Insight/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('renderForeInsightHtml: enrichment parameter is accepted but not required (Layer 2 seam, unused today)', () => {
  const facts = [{ kind: 'completion', text: 'Tower X was completed in 2021.' }];
  assert.equal(renderForeInsightHtml(facts), renderForeInsightHtml(facts, null));
});
