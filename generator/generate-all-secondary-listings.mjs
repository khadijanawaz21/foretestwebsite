/**
 * generator/generate-all-secondary-listings.mjs
 * Generates a static page for every published secondary_listings row,
 * reusing buildPropertyPage() from generate-property-page.mjs (no
 * duplicated generation logic). Continues past individual listing
 * failures and produces an aggregate build report. Does not touch
 * offplan_listings. Standalone script — not wired into
 * build.mjs/vercel.json.
 *   node generator/generate-all-secondary-listings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchPublishedProperties } from './lib/supabase.mjs';
import { buildPropertyPage } from './generate-property-page.mjs';
import { normalizeSecondaryListing } from './lib/normalize-property.mjs';
import { validateGeneratedPages } from './lib/validate.mjs';
import { createLogger } from './lib/logger.mjs';
import { REPO_ROOT } from './config.mjs';

const logger = createLogger('generate-all-secondary');

function writePageToDisk(result) {
  const outputPath = path.join(REPO_ROOT, result.outputRelativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.html, 'utf8');
}

/** Best-effort slug lookup for a failure record — undefined if normalization itself is what failed. */
function attemptSlug(row) {
  try {
    return normalizeSecondaryListing(row).slug;
  } catch {
    return undefined;
  }
}

/**
 * Pure batch core: given already-fetched rows and an injectable page
 * writer, builds every page via buildPropertyPage(), continuing past
 * individual failures. No network access — safe to unit test with
 * synthetic rows and a fake writer.
 * @param {Array<object>} rows
 * @param {{writePage?: (result: object) => void}} [options]
 */
export function runBatch(rows, { writePage = writePageToDisk } = {}) {
  const startedAt = Date.now();
  const succeeded = [];
  const failures = [];

  for (const row of rows) {
    try {
      const result = buildPropertyPage(row);
      writePage(result);
      succeeded.push(result);
    } catch (err) {
      failures.push({
        id: row?.id,
        slug: attemptSlug(row),
        name: row?.name || row?.building_name || '(unknown)',
        reason: err.message,
      });
    }
  }

  const batchIssues = validateGeneratedPages(
    succeeded.map((r) => ({
      pageType: 'property',
      outputPath: r.canonicalUrl,
      title: r.title,
      description: r.description,
    }))
  );
  const validationWarnings = batchIssues.filter((i) => i.severity === 'warning');
  const validationErrors = batchIssues.filter((i) => i.severity === 'error');
  const duplicateTitles = validationErrors.filter((i) => i.message.startsWith('Duplicate title'));
  const duplicateDescriptions = validationErrors.filter((i) => i.message.startsWith('Duplicate description'));

  return {
    totalFound: rows.length,
    succeeded: succeeded.length,
    failed: failures.length,
    failures,
    validationWarnings,
    validationErrors,
    duplicateTitles,
    duplicateDescriptions,
    durationMs: Date.now() - startedAt,
  };
}

function printReport(report) {
  logger.info('===== BUILD REPORT =====');
  logger.info(`Total listings found:        ${report.totalFound}`);
  logger.info(`Successfully generated:      ${report.succeeded}`);
  logger.info(`Failed:                      ${report.failed}`);
  report.failures.forEach((f) => logger.info(`  - [${f.id}]${f.slug ? ` (${f.slug})` : ''} ${f.name}: ${f.reason}`));
  logger.info(`Validation warnings:         ${report.validationWarnings.length}`);
  report.validationWarnings.forEach((w) => logger.info(`  - ${w.message}`));
  logger.info(`Validation errors:           ${report.validationErrors.length}`);
  report.validationErrors.forEach((e) => logger.info(`  - ${e.message}`));
  logger.info(`Duplicate titles:            ${report.duplicateTitles.length}`);
  logger.info(`Duplicate meta descriptions: ${report.duplicateDescriptions.length}`);
  logger.info(`Build duration:              ${report.durationMs}ms`);
  logger.info('=========================');
}

async function main() {
  logger.info('Fetching all published secondary_listings...');
  const rows = await fetchPublishedProperties();
  logger.info(`Found ${rows.length} published listing(s).`);

  const report = runBatch(rows);
  printReport(report);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logger.error(err.stack || err.message);
    process.exitCode = 1;
  });
}
