#!/usr/bin/env node
/**
 * generator/build.mjs
 * Vercel buildCommand entry point. Generates every published
 * secondary_listings property page by reusing runBatch() from
 * generate-all-secondary-listings.mjs (no duplicated generation logic),
 * writes a build manifest, and hard-fails the build (non-zero exit) if
 * zero listings are found or zero pages succeed. Individual listing
 * failures remain non-fatal — see runBatch().
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from './lib/logger.mjs';
import { fetchPublishedProperties } from './lib/supabase.mjs';
import { runBatch } from './generate-all-secondary-listings.mjs';
import { CACHE_DIR, BUILD_MANIFEST_PATH } from './config.mjs';

const logger = createLogger('build');

/**
 * Maps a runBatch() report to the required build manifest shape.
 * Pure — no I/O.
 */
export function buildManifest(report) {
  return {
    generated_at: new Date().toISOString(),
    total_found: report.totalFound,
    succeeded: report.succeeded,
    failed: report.failed,
    warnings: report.validationWarnings,
    errors: report.validationErrors,
    build_duration_ms: report.durationMs,
  };
}

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

function writeManifest(manifest) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(BUILD_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  logger.info(`Wrote build manifest: ${path.relative(process.cwd(), BUILD_MANIFEST_PATH)}`);
}

async function main() {
  logger.info('FORE static page generator — production build starting');

  let rows;
  try {
    rows = await fetchPublishedProperties();
  } catch (err) {
    logger.error(`Failed to fetch published properties: ${err.message}`);
    throw new Error(`Build aborted: could not fetch listings (${err.message})`);
  }
  logger.info(`Fetched ${rows.length} published listing(s).`);

  const report = runBatch(rows);
  const manifest = buildManifest(report);
  writeManifest(manifest);

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
  main()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((err) => {
      logger.error(err.stack || err.message);
      process.exitCode = 1;
    });
}
