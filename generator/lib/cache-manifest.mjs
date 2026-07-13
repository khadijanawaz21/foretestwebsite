/**
 * generator/lib/cache-manifest.mjs
 *
 * Best-effort incremental-build content-hash manifest, per Static Page
 * Generator Specification §9. Single responsibility: track, across
 * builds, a hash per generated output path so unchanged pages can be
 * skipped. Explicitly an optimization, never a correctness dependency —
 * per the spec's design stance, the generator must produce a correct
 * full rebuild if this manifest is missing, empty, or stale.
 *
 * STATUS (Sprint 1 — foundation): unimplemented. The spec also flags an
 * open question (§16) that must be answered before this module is relied
 * on for anything beyond "nice to have": whether Vercel's build cache
 * actually persists a custom directory like generator/.cache/ across
 * builds for a non-framework ("Other" preset) project. That needs an
 * empirical test, not an assumption baked into this module.
 */
import { NotImplementedError } from './errors.mjs';

/**
 * @param {string} manifestPath
 * @returns {Promise<Record<string, {dataHash: string, generatedAt: string}>>}
 *   Empty object if the manifest doesn't exist yet — never throws for a
 *   missing file, since a cold cache must always be a valid starting state.
 */
export async function loadManifest(manifestPath) {
  throw new NotImplementedError('loadManifest', 'Sprint 2+ (SSG Spec §9) — optimization, not required for a correct first build');
}

/**
 * @param {string} manifestPath
 * @param {Record<string, {dataHash: string, generatedAt: string}>} manifest
 * @returns {Promise<void>}
 */
export async function saveManifest(manifestPath, manifest) {
  throw new NotImplementedError('saveManifest', 'Sprint 2+ (SSG Spec §9) — optimization, not required for a correct first build');
}

/**
 * @param {Record<string, {dataHash: string}>} manifest
 * @param {string} outputPath
 * @param {string} newHash
 * @returns {boolean} True if outputPath is missing from the manifest or its hash differs.
 */
export function hasChanged(manifest, outputPath, newHash) {
  throw new NotImplementedError('hasChanged', 'Sprint 2+ (SSG Spec §9) — optimization, not required for a correct first build');
}
