/**
 * generator/lib/page-assets.mjs
 * Shared helpers for reusing existing site markup/CSS at generation time,
 * so property/area/developer/blog templates don't each duplicate this
 * logic (Static Page Generator Spec §6 "reuse the current HTML/CSS").
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../config.mjs';

/** Reads a file relative to the repository root. */
export function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

/** Extracts every inline <style> block from an HTML file's source, concatenated in order. */
export function extractStyleBlocks(html) {
  const matches = html.match(/<style[^>]*>[\s\S]*?<\/style>/g);
  if (!matches || matches.length === 0) {
    throw new Error('extractStyleBlocks: no <style> block found in the given HTML.');
  }
  return matches.join('\n');
}

/** Rewrites root-relative href/src values (as used by components/*.html) to absolute paths, since generated pages live in nested directories. */
export function rewriteRootRelativeUrls(html) {
  return html.replace(/(href|src)="([^"]+)"/g, (full, attr, value) => {
    if (/^(https?:|mailto:|tel:|#|\/)/.test(value)) return full;
    return `${attr}="/${value}"`;
  });
}
