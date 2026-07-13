/**
 * generator/build.test.mjs
 * Run: node --test generator/build.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateBuildFailure,
  buildManifest,
  buildFetchFailureManifest,
  buildCleanupFailureManifest,
  runProductionBuild,
} from './build.mjs';

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

test('buildManifest: success case includes existing fields unchanged', () => {
  const manifest = buildManifest({
    totalFound: 8,
    succeeded: 8,
    failed: 0,
    failures: [],
    validationWarnings: [{ severity: 'warning', message: 'x' }],
    validationErrors: [],
    durationMs: 42,
  });
  assert.equal(manifest.total_found, 8);
  assert.equal(manifest.succeeded, 8);
  assert.equal(manifest.failed, 0);
  assert.equal(manifest.warnings.length, 1);
  assert.equal(manifest.errors.length, 0);
  assert.equal(manifest.build_duration_ms, 42);
  assert.equal(typeof manifest.generated_at, 'string');
  assert.equal(manifest.status, 'success');
  assert.equal(manifest.failure_stage, null);
  assert.equal(manifest.error_message, null);
  assert.deepEqual(manifest.failures, []);
});

test('buildManifest: generation failure sets status/failure_stage/error_message', () => {
  const manifest = buildManifest({
    totalFound: 3,
    succeeded: 0,
    failed: 3,
    failures: [
      { id: 1, slug: undefined, name: 'A', reason: 'boom' },
      { id: 2, slug: 'unit-2', name: 'B', reason: 'missing price' },
    ],
    validationWarnings: [],
    validationErrors: [],
    durationMs: 10,
  });
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.failure_stage, 'generation');
  assert.match(manifest.error_message, /zero pages were successfully generated/);
  assert.deepEqual(manifest.failures, [
    { id: 1, slug: null, error_message: 'boom' },
    { id: 2, slug: 'unit-2', error_message: 'missing price' },
  ]);
});

test('buildFetchFailureManifest: reflects an unknown total_found and zero-everything-else', () => {
  const manifest = buildFetchFailureManifest('SUPABASE_URL and/or SERVICE_KEY are not set.', 15);
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.failure_stage, 'fetch');
  assert.equal(manifest.error_message, 'SUPABASE_URL and/or SERVICE_KEY are not set.');
  assert.equal(manifest.total_found, null);
  assert.equal(manifest.succeeded, 0);
  assert.equal(manifest.failed, 0);
  assert.deepEqual(manifest.failures, []);
  assert.deepEqual(manifest.warnings, []);
  assert.deepEqual(manifest.errors, []);
  assert.equal(manifest.build_duration_ms, 15);
  assert.equal(typeof manifest.generated_at, 'string');
});

test('buildCleanupFailureManifest: same zero-everything shape, tagged as the cleanup stage', () => {
  const manifest = buildCleanupFailureManifest('EACCES: permission denied', 3);
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.failure_stage, 'cleanup');
  assert.equal(manifest.error_message, 'EACCES: permission denied');
  assert.equal(manifest.total_found, null);
  assert.equal(manifest.succeeded, 0);
  assert.equal(manifest.failed, 0);
  assert.deepEqual(manifest.failures, []);
});

test('runProductionBuild: cleanup failure writes a cleanup-stage manifest and aborts before fetch/generate run', async () => {
  let fetchCalled = false;
  let generateCalled = false;
  let writtenManifest = null;

  await assert.rejects(
    () =>
      runProductionBuild({
        clean: () => {
          throw new Error('EACCES: permission denied');
        },
        fetchProperties: async () => {
          fetchCalled = true;
          return [];
        },
        generate: () => {
          generateCalled = true;
          return {};
        },
        writeManifestFn: (manifest) => {
          writtenManifest = manifest;
        },
      }),
    /Build aborted: could not clean output directory/
  );

  assert.equal(fetchCalled, false);
  assert.equal(generateCalled, false);
  assert.ok(writtenManifest);
  assert.equal(writtenManifest.status, 'failed');
  assert.equal(writtenManifest.failure_stage, 'cleanup');
  assert.match(writtenManifest.error_message, /permission denied/);
});

test('runProductionBuild: fetch failure still aborts before generate runs (cleanup already succeeded)', async () => {
  let cleanCalled = false;
  let generateCalled = false;
  let writtenManifest = null;

  await assert.rejects(
    () =>
      runProductionBuild({
        clean: () => {
          cleanCalled = true;
        },
        fetchProperties: async () => {
          throw new Error('network error');
        },
        generate: () => {
          generateCalled = true;
          return {};
        },
        writeManifestFn: (manifest) => {
          writtenManifest = manifest;
        },
      }),
    /Build aborted: could not fetch listings/
  );

  assert.equal(cleanCalled, true);
  assert.equal(generateCalled, false);
  assert.equal(writtenManifest.failure_stage, 'fetch');
});

test('runProductionBuild: happy path cleans, fetches, generates, and writes a success manifest', async () => {
  let cleanCalled = false;
  let writtenManifest = null;

  await runProductionBuild({
    clean: () => {
      cleanCalled = true;
    },
    fetchProperties: async () => [{ id: 1 }],
    generate: () => ({
      totalFound: 1,
      succeeded: 1,
      succeededPages: [{ canonicalUrl: 'https://fairopportunityrealestate.com/properties/a/unit-1/' }],
      failed: 0,
      failures: [],
      validationWarnings: [],
      validationErrors: [],
      durationMs: 5,
    }),
    writeManifestFn: (manifest) => {
      writtenManifest = manifest;
    },
    writeSitemapFn: () => {},
  });

  assert.equal(cleanCalled, true);
  assert.equal(writtenManifest.status, 'success');
  assert.equal(writtenManifest.total_found, 1);
});

test('runProductionBuild: successful generation writes a sitemap containing the generated property URL', async () => {
  let writtenSitemap = null;

  await runProductionBuild({
    clean: () => {},
    fetchProperties: async () => [{ id: 1 }],
    generate: () => ({
      totalFound: 1,
      succeeded: 1,
      succeededPages: [{ canonicalUrl: 'https://fairopportunityrealestate.com/properties/a/unit-1/' }],
      failed: 0,
      failures: [],
      validationWarnings: [],
      validationErrors: [],
      durationMs: 5,
    }),
    writeManifestFn: () => {},
    writeSitemapFn: (xml) => {
      writtenSitemap = xml;
    },
  });

  assert.ok(writtenSitemap);
  assert.match(writtenSitemap, /<loc>https:\/\/fairopportunityrealestate\.com\/properties\/a\/unit-1\/<\/loc>/);
});

test('runProductionBuild: a hard generation failure (zero succeeded) does not write a sitemap', async () => {
  let sitemapWritten = false;

  await assert.rejects(
    () =>
      runProductionBuild({
        clean: () => {},
        fetchProperties: async () => [{ id: 1 }],
        generate: () => ({
          totalFound: 1,
          succeeded: 0,
          succeededPages: [],
          failed: 1,
          failures: [{ id: 1, slug: null, reason: 'boom' }],
          validationWarnings: [],
          validationErrors: [],
          durationMs: 5,
        }),
        writeManifestFn: () => {},
        writeSitemapFn: () => {
          sitemapWritten = true;
        },
      }),
    /zero pages were successfully generated/
  );

  assert.equal(sitemapWritten, false);
});

test('runProductionBuild: a cleanup failure does not write a sitemap', async () => {
  let sitemapWritten = false;

  await assert.rejects(
    () =>
      runProductionBuild({
        clean: () => {
          throw new Error('EACCES');
        },
        fetchProperties: async () => [{ id: 1 }],
        generate: () => ({ totalFound: 1, succeeded: 1, succeededPages: [], failed: 0, failures: [], validationWarnings: [], validationErrors: [], durationMs: 1 }),
        writeManifestFn: () => {},
        writeSitemapFn: () => {
          sitemapWritten = true;
        },
      }),
    /Build aborted: could not clean output directory/
  );

  assert.equal(sitemapWritten, false);
});
