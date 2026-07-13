/**
 * generator/lib/redirects.mjs
 * Builds (but does not apply) legacy-URL -> canonical-URL redirect data
 * for property pages. Maps each successfully generated listing's id to
 * its canonical URL, reusing runBatch's report (`report.succeededPages`,
 * which already carries `{id, canonicalUrl}`) rather than rediscovering
 * anything from the filesystem or re-normalizing rows. The actual HTTP
 * redirect is applied by middleware.js, which statically imports the
 * manifest this module writes (see REDIRECT_MANIFEST_PATH in config.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { REDIRECT_MANIFEST_PATH } from '../config.mjs';

/** The legacy URL pattern being replaced, recorded for reference/debugging. */
export const LEGACY_URL_PATTERN = '/property-detail.html?id={id}&type=secondary';

function legacyUrlFor(id) {
  return `/property-detail.html?id=${id}&type=secondary`;
}

/**
 * Builds the redirect manifest from a runBatch() report. Only listings
 * present in `succeededPages` are included — failed/unpublished listings
 * are absent from that list already, so nothing extra needs filtering
 * here. Entries are deduplicated by id (first occurrence wins) and
 * sorted by id ascending so the manifest is byte-for-byte deterministic
 * regardless of the order Supabase returned rows in. Pure — no I/O.
 * @param {{succeededPages: Array<{id: string|number, canonicalUrl: string}>}} report
 */
export function buildRedirectManifest(report) {
  const seenIds = new Set();
  const redirects = [];

  for (const page of report.succeededPages) {
    if (seenIds.has(page.id)) continue;
    seenIds.add(page.id);
    redirects.push({
      id: page.id,
      legacy_url: legacyUrlFor(page.id),
      canonical_url: page.canonicalUrl,
    });
  }

  redirects.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  return {
    generated_at: new Date().toISOString(),
    legacy_pattern: LEGACY_URL_PATTERN,
    total: redirects.length,
    redirects,
  };
}

/** Writes the redirect manifest to disk, creating its parent directory if needed. */
export function writeRedirectManifest(manifest, outputPath = REDIRECT_MANIFEST_PATH) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
}
