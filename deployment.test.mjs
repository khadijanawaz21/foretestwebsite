/**
 * deployment.test.mjs
 * Guards against the exact regression that broke the Vercel Preview
 * Deployment: the redirect manifest must be a production deployment
 * artifact at the repo root (like sitemap.xml), not a generator/.cache/
 * file — Vercel's Edge Function bundler excludes gitignored/.cache
 * paths from middleware.js's static import trace regardless of what
 * buildCommand recreates there at build time.
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

test("middleware.js statically imports the redirect manifest from the exact path config.mjs defines", () => {
  const middlewareSource = fs.readFileSync(path.join(REPO_ROOT, 'middleware.js'), 'utf8');
  const expectedSpecifier = `./${path.relative(REPO_ROOT, REDIRECT_MANIFEST_PATH)}`;

  const importLine = middlewareSource.split('\n').find((line) => line.startsWith('import redirectManifest'));
  assert.ok(importLine, 'expected an import statement for redirectManifest');
  assert.equal(importLine, `import redirectManifest from '${expectedSpecifier}' with { type: 'json' };`);
  assert.doesNotMatch(importLine, /generator\/\.cache/);
});

test('.gitignore treats redirect-manifest.json the same as sitemap.xml (repo-root generated artifact)', () => {
  const gitignore = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\/sitemap\.xml$/m);
  assert.match(gitignore, /^\/redirect-manifest\.json$/m);
});
