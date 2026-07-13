#!/usr/bin/env node
/**
 * generator/build.mjs
 *
 * Entry point for the FORE static page generator ("fore-ssg"). Invoked
 * via `node generator/build.mjs`, and — once wired into vercel.json's
 * buildCommand — automatically on every Vercel deploy.
 *
 * Governing documents (source of truth for this whole system):
 *   - Repository Audit (technical due diligence)
 *   - Master Implementation Roadmap (Sprint 4)
 *   - Static Page Generator Specification (this file implements it)
 *   - FORE Knowledge Architecture (the entity model this generator serves)
 *
 * SPRINT 1 STATUS — FOUNDATION ONLY
 * ----------------------------------
 * This build does not generate any pages. It exists to prove that:
 *   1. The generator's folder structure and module wiring are correct.
 *   2. Required configuration/environment variables are discoverable and
 *      validated (without ever printing secret values).
 *   3. The build can run safely inside Vercel's build step with ZERO
 *      effect on the current, live website — no output directories are
 *      created, no existing template is read, no page-type logic runs.
 *
 * Per the Static Page Generator Spec's design principle #5 ("correct
 * under a full rebuild, always") and the explicit Sprint 1 instruction
 * not to touch production pages, this script is intentionally
 * fail-open: any error is logged clearly and the process still exits 0,
 * so that wiring this into vercel.json's buildCommand can never break a
 * deploy during this foundation sprint. This fail-open behavior should
 * be revisited once real page generation exists and the validation gate
 * in lib/validate.mjs (Spec §10) is implemented — at that point, a
 * genuinely bad build SHOULD be allowed to fail loudly instead.
 */
import fs from 'node:fs';
import { createLogger } from './lib/logger.mjs';
import { getServiceClient } from './lib/supabase.mjs';
import { CACHE_DIR, PAGE_TYPES, REQUIRED_ENV_VARS, OPTIONAL_ENV_VARS, config } from './config.mjs';

const logger = createLogger('build');

/** Logs which required/optional env vars are present, without ever printing values. */
function checkEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length) {
    logger.warn(
      `Missing environment variable(s): ${missing.join(', ')}. Sprint 1 checks will still ` +
        'complete, but real data fetching in later sprints will fail until these are set. See .env.example.'
    );
  } else {
    logger.info('All required environment variables are present.');
  }

  for (const name of OPTIONAL_ENV_VARS) {
    logger.debug(`Optional env var ${name}: ${process.env[name] ? 'set' : 'not set (default behavior applies)'}`);
  }

  return missing;
}

/** Ensures the best-effort incremental-build cache directory exists (Spec §9). Never fatal. */
function ensureCacheDir() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    logger.debug(`Cache directory ready: ${CACHE_DIR}`);
  } catch (err) {
    logger.warn(`Could not create cache directory (${CACHE_DIR}): ${err.message}`);
  }
}

/** Proves the Supabase wiring works when credentials are present. Runs no query. */
function attemptSupabaseWiring() {
  try {
    getServiceClient();
    logger.info('Supabase service-role client initialized successfully (no queries were run).');
  } catch (err) {
    logger.warn(`Supabase client not initialized: ${err.message}`);
  }
}

/** Logs the page-type registry so it's visible in build output that nothing generates yet. */
function summarizePageTypes() {
  logger.info('Page-type registry (Sprint 1 — all not_implemented by design):');
  for (const [key, def] of Object.entries(PAGE_TYPES)) {
    logger.info(`  - ${def.label} (${key}): status=${def.status}, output=${def.outputPathPattern}`);
  }
}

async function main() {
  logger.info('FORE static page generator — Sprint 1 (foundation) build starting');
  logger.info(`Site base URL: ${config.siteUrl || '(not set)'}`);

  checkEnvVars();
  ensureCacheDir();
  attemptSupabaseWiring();
  summarizePageTypes();

  logger.info(
    'Sprint 1 complete: 0 pages generated (by design). No existing templates were read or ' +
      'modified. No output directories (/properties, /areas, /developers, /blog) were created. ' +
      'Real generation begins in Sprint 2 per the approved Static Page Generator Specification.'
  );
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    // Fail-open (see module doc comment above): log loudly, never fail the
    // Vercel build during this foundation sprint.
    logger.error(`Unexpected error in generator build (non-fatal for Sprint 1): ${err.stack || err.message}`);
    process.exitCode = 0;
  });
