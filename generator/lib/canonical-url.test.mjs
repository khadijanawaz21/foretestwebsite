/**
 * generator/lib/canonical-url.test.mjs
 * Run: node --test generator/lib/canonical-url.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propertyPagePath } from './canonical-url.mjs';

test('propertyPagePath: builds the /properties/{areaSlug}/{slug}/ path', () => {
  const path = propertyPagePath({ areaSlug: 'dubai-marina', slug: 'unit-42' });
  assert.equal(path, '/properties/dubai-marina/unit-42/');
});
