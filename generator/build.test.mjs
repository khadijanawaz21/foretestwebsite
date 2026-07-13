/**
 * generator/build.test.mjs
 * Run: node --test generator/build.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBuildFailure, buildManifest } from './build.mjs';

test('evaluateBuildFailure: fails when zero listings were found', () => {
  const reason = evaluateBuildFailure({ totalFound: 0, succeeded: 0 });
  assert.match(reason, /zero published listings/);
});

test('evaluateBuildFailure: fails when listings were found but none succeeded', () => {
  const reason = evaluateBuildFailure({ totalFound: 5, succeeded: 0 });
  assert.match(reason, /zero pages were successfully generated/);
});

test('evaluateBuildFailure: passes when at least one page succeeded', () => {
  const reason = evaluateBuildFailure({ totalFound: 5, succeeded: 1 });
  assert.equal(reason, null);
});

test('evaluateBuildFailure: passes when all listings succeeded', () => {
  const reason = evaluateBuildFailure({ totalFound: 8, succeeded: 8 });
  assert.equal(reason, null);
});

test('buildManifest: maps the batch report to the required manifest shape', () => {
  const manifest = buildManifest({
    totalFound: 8,
    succeeded: 7,
    failed: 1,
    validationWarnings: [{ severity: 'warning', message: 'x' }],
    validationErrors: [],
    durationMs: 42,
  });
  assert.equal(manifest.total_found, 8);
  assert.equal(manifest.succeeded, 7);
  assert.equal(manifest.failed, 1);
  assert.equal(manifest.warnings.length, 1);
  assert.equal(manifest.errors.length, 0);
  assert.equal(manifest.build_duration_ms, 42);
  assert.equal(typeof manifest.generated_at, 'string');
});
