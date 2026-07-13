#!/usr/bin/env node
/**
 * generator/build.mjs
 * Vercel buildCommand entry point. Wipes the properties output directory
 * (see lib/output-cleanup.mjs) so removed/unpublished listings can't
 * leave stale pages behind, then generates every published
 * secondary_listings property page by reusing runBatch() from
 * generate-all-secondary-listings.mjs (no duplicated generation logic).
 * Always writes a build manifest — including when cleanup or the
 * Supabase fetch itself fails — and hard-fails the build (non-zero exit)
 * if cleanup fails, zero listings are found, or zero pages succeed.
 * Individual listing failures remain non-fatal — see runBatch().
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from './lib/logger.mjs';
import { fetchPublishedProperties } from './lib/supabase.mjs';
import { runBatch } from './generate-all-secondary-listings.mjs';
import { cleanPropertiesOutputDir, PROPERTIES_OUTPUT_DIR } from './lib/output-cleanup.mjs';
import { CACHE_DIR, BUILD_MANIFEST_PATH } from './config.mjs';

const logger = createLogger('build');

/**
 * Decides whether the build must hard-fail. Returns an error message if
 * so, or null if the build should proceed. Pure — no I/O.
 */
export function evaluateBuildFailure(report) {
  if (report.totalFound === 0) {
    return 'Build aborted: zero published listings were returned from Supabase.';
  }
  if (report.succeeded === 0) {
    return 'Build aborted: zero pages were successfully generated despite listings being found.';
  }
  return null;
}

/**
 * Maps a runBatch() report to the manifest shape for a build that
 * completed fetching (whether or not generation itself succeeded). Pure.
 */
export function buildManifest(report) {
  const failureReason = evaluateBuildFailure(report);
  return {
    generated_at: new Date().toISOString(),
    status: failureReason ? 'failed' : 'success',
    failure_stage: failureReason ? 'generation' : null,
    error_message: failureReason,
    total_found: report.totalFound,
    succeeded: report.succeeded,
    failed: report.failed,
    failures: report.failures.map((f) => ({ id: f.id, slug: f.slug ?? null, error_message: f.reason })),
    warnings: report.validationWarnings,
    errors: report.validationErrors,
    build_duration_ms: report.durationMs,
  };
}

/**
 * Manifest for a build that aborted before a report could be produced
 * (cleanup or fetch) — every generation-related field is its "nothing
 * happened" value rather than omitted. Pure.
 */
export function buildEarlyFailureManifest(stage, errorMessage, durationMs) {
  return {
    generated_at: new Date().toISOString(),
    status: 'failed',
    failure_stage: stage,
    error_message: errorMessage,
    total_found: null,
    succeeded: 0,
    failed: 0,
    failures: [],
    warnings: [],
    errors: [],
    build_duration_ms: durationMs,
  };
}

/** Manifest for a cleanup-stage failure. Pure. */
export function buildCleanupFailureManifest(errorMessage, durationMs) {
  return buildEarlyFailureManifest('cleanup', errorMessage, durationMs);
}

/** Manifest for the case where the Supabase fetch itself threw. Pure. */
export function buildFetchFailureManifest(errorMessage, durationMs) {
  return buildEarlyFailureManifest('fetch', errorMessage, durationMs);
}

function writeManifest(manifest) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(BUILD_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  logger.info(`Wrote build manifest: ${path.relative(process.cwd(), BUILD_MANIFEST_PATH)}`);
}

/**
 * Full build orchestration with injectable steps — mirrors the
 * pure-core/I-O-shell pattern runBatch() already uses for writePage.
 * Injecting `clean`/`fetchProperties`/`generate`/`writeManifestFn` lets
 * each stage-abort path (cleanup, fetch) be exercised in tests without
 * touching the real filesystem or network. Default params wire it to the
 * real implementations for production use via main().
 */
export async function runProductionBuild({
  clean = cleanPropertiesOutputDir,
  fetchProperties = fetchPublishedProperties,
  generate = runBatch,
  writeManifestFn = writeManifest,
} = {}) {
  const startedAt = Date.now();
  logger.info('FORE static page generator — production build starting');

  try {
    clean();
  } catch (err) {
    logger.error(`Failed to clean properties output directory: ${err.message}`);
    writeManifestFn(buildCleanupFailureManifest(err.message, Date.now() - startedAt));
    throw new Error(`Build aborted: could not clean output directory (${err.message})`);
  }
  logger.info(`Cleaned ${path.relative(process.cwd(), PROPERTIES_OUTPUT_DIR)}`);

  let rows;
  try {
    rows = await fetchProperties();
  } catch (err) {
    logger.error(`Failed to fetch published properties: ${err.message}`);
    writeManifestFn(buildFetchFailureManifest(err.message, Date.now() - startedAt));
    throw new Error(`Build aborted: could not fetch listings (${err.message})`);
  }
  logger.info(`Fetched ${rows.length} published listing(s).`);

  const report = generate(rows);
  const manifest = buildManifest(report);
  writeManifestFn(manifest);

  logger.info(
    `Generated ${report.succeeded}/${report.totalFound} page(s), ${report.failed} failed, ` +
      `${report.validationWarnings.length} warning(s), ${report.validationErrors.length} error(s), ${report.durationMs}ms.`
  );

  const failureReason = evaluateBuildFailure(report);
  if (failureReason) {
    throw new Error(failureReason);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionBuild()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((err) => {
      logger.error(err.stack || err.message);
      process.exitCode = 1;
    });
}
