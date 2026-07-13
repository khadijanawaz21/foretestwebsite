/**
 * generator/lib/output-cleanup.test.mjs
 * Run: node --test generator/lib/output-cleanup.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanPropertiesOutputDir } from './output-cleanup.mjs';

function makeTempDirWithFiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fore-ssg-cleanup-'));
  fs.mkdirSync(path.join(dir, 'stale-area', 'stale-listing'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'stale-area', 'stale-listing', 'index.html'), '<html></html>', 'utf8');
  return dir;
}

test('cleanPropertiesOutputDir: removes an existing directory and its contents', () => {
  const dir = makeTempDirWithFiles();
  assert.equal(fs.existsSync(dir), true);

  cleanPropertiesOutputDir(dir);

  assert.equal(fs.existsSync(dir), false);
});

test('cleanPropertiesOutputDir: a missing directory is not an error', () => {
  const dir = path.join(os.tmpdir(), 'fore-ssg-cleanup-does-not-exist');
  assert.equal(fs.existsSync(dir), false);

  assert.doesNotThrow(() => cleanPropertiesOutputDir(dir));
});

test('cleanPropertiesOutputDir: propagates a failure from the underlying fs call', () => {
  const failingFs = {
    existsSync: () => true,
    rmSync: () => {
      throw new Error('permission denied');
    },
  };

  assert.throws(() => cleanPropertiesOutputDir('/some/path', failingFs), /permission denied/);
});
