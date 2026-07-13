/**
 * generator/lib/output-cleanup.mjs
 * Deterministic full-wipe cleanup of the generated properties output
 * directory, run before every production build so a listing that was
 * deleted or unpublished in Supabase cannot leave a stale page behind.
 * No diffing, no per-listing tracking — the whole directory is removed
 * and generation recreates it from scratch on the current dataset.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../config.mjs';

/** Root of all generated property pages (see buildPropertyPage's outputRelativePath). */
export const PROPERTIES_OUTPUT_DIR = path.join(REPO_ROOT, 'properties');

/**
 * Removes `dirPath` (and everything in it) if it exists. A missing
 * directory is not an error — nothing to clean. `fsImpl` is injectable
 * for testing; it must expose `existsSync`/`rmSync` with Node's fs
 * signatures.
 * @param {string} [dirPath]
 * @param {{existsSync: Function, rmSync: Function}} [fsImpl]
 */
export function cleanPropertiesOutputDir(dirPath = PROPERTIES_OUTPUT_DIR, fsImpl = fs) {
  if (fsImpl.existsSync(dirPath)) {
    fsImpl.rmSync(dirPath, { recursive: true, force: true });
  }
}
