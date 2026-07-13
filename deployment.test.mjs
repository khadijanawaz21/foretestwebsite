/**
 * deployment.test.mjs
 * Guards against two regressions that each broke Vercel deployment:
 * (1) the redirect manifest must be a production deployment artifact at
 * the repo root (like sitemap.xml), not a generator/.cache/ file, and
 * (2) middleware.js must NOT statically import it — Vercel's Edge
 * Function bundler excludes gitignored paths from a static-import trace
 * regardless of what buildCommand recreates there at build time or which
 * directory the file lives in (this broke both the .cache/ location and,
 * later, the repo-root location — see middleware.js's doc comment).
 * middleware.js instead fetches the manifest at request time as an
 * ordinary static asset.
 * Run: node --test deployment.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REDIRECT_MANIFEST_PATH, SITEMAP_PATH, REPO_ROOT, CACHE_DIR } from './generator/config.mjs';

test('REDIRECT_MANIFEST_PATH is a repo-root deployment artifact, not a generator/.cache file', () => {
  assert.equal(path.dirname(REDIRECT_MANIFEST_PATH), REPO_ROOT);
  assert.equal(path.dirname(REDIRECT_MANIFEST_PATH), path.dirname(SITEMAP_PATH));
  assert.equal(REDIRECT_MANIFEST_PATH.startsWith(CACHE_DIR), false);
});

test('middleware.js does not statically import the redirect manifest (Edge bundler excludes gitignored import targets)', () => {
  const middlewareSource = fs.readFileSync(path.join(REPO_ROOT, 'middleware.js'), 'utf8');
  const importLines = middlewareSource.split('\n').filter((line) => line.trim().startsWith('import '));
  assert.ok(importLines.every((line) => !line.includes('redirect-manifest.json')));
  assert.ok(importLines.every((line) => !line.includes('generator/.cache')));
});

test('middleware.js fetches the redirect manifest at runtime as a static asset instead', () => {
  const middlewareSource = fs.readFileSync(path.join(REPO_ROOT, 'middleware.js'), 'utf8');
  assert.match(middlewareSource, /fetch\(new URL\(['"]\/redirect-manifest\.json['"]/);
});

test('.gitignore treats redirect-manifest.json the same as sitemap.xml (repo-root generated artifact)', () => {
  const gitignore = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\/sitemap\.xml$/m);
  assert.match(gitignore, /^\/redirect-manifest\.json$/m);
});
