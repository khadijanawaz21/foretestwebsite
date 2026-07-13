/**
 * generator/lib/supabase.mjs
 *
 * Data access layer for the static page generator.
 *
 * Per the Static Page Generator Specification §13, the generator
 * authenticates with Supabase using the SERVICE ROLE key (reusing the
 * same `SERVICE_KEY` environment variable name already used by
 * api/sync-listings.js and api/sync-pf-listings.js) — never the public
 * anon key used by the browser — so build-time generation has full read
 * access independent of the Row Level Security policies that govern
 * client-side access.
 *
 * The Supabase project URL (not a secret) comes from config.mjs's
 * `config.supabaseUrl`. SERVICE_KEY (a secret) is the one documented
 * exception to "config.mjs is the only module that reads process.env" —
 * it is read directly, here, once, so it never flows through the shared
 * `config` object where it could be accidentally logged or re-exported.
 *
 * STATUS (Sprint 1 — foundation): only getServiceClient() is implemented,
 * and it performs no network call by itself (constructing a Supabase
 * client is synchronous/local; the first actual query is what would hit
 * the network). The query helpers below are intentionally stubbed — the
 * tables/fields they depend on are only partially decided today. Notably,
 * the `areas` and `developers` tables described in the Static Page
 * Generator Spec §3 and Knowledge Architecture Part 1 do not exist in
 * Supabase yet; creating them is out of scope for this foundation sprint.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.mjs';
import { ConfigError, NotImplementedError } from './errors.mjs';
import { createLogger } from './logger.mjs';

const logger = createLogger('supabase');

let cachedClient = null;

/**
 * Returns a singleton Supabase client authenticated with the service-role
 * key. Throws ConfigError if the Supabase URL / SERVICE_KEY are not set.
 *
 * Callers must catch this — the generator is designed to never crash the
 * Vercel build over missing credentials during this foundation sprint
 * (see build.mjs's module doc comment for the full rationale).
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getServiceClient() {
  if (cachedClient) return cachedClient;

  const url = config.supabaseUrl;
  const serviceKey = process.env.SERVICE_KEY; // secret — read directly, see module doc comment

  if (!url || !serviceKey) {
    throw new ConfigError(
      'SUPABASE_URL and/or SERVICE_KEY are not set. See .env.example at the repository root.'
    );
  }

  cachedClient = createClient(url, serviceKey);
  logger.debug('Supabase service-role client created (no query executed yet).');
  return cachedClient;
}

/**
 * Fetches published off-plan + secondary listings for property-page
 * generation. Not implemented — see Static Page Generator Spec Part 15,
 * Phase B.
 * @returns {Promise<Array<object>>}
 */
export async function fetchPublishedProperties() {
  throw new NotImplementedError('fetchPublishedProperties', 'Sprint 2 (SSG Spec Phase A/B)');
}

/**
 * Fetches published rows from the `areas` table (SSG Spec §3 / Knowledge
 * Architecture Part 1). Not implemented — the table itself does not
 * exist yet, in addition to this function.
 * @returns {Promise<Array<object>>}
 */
export async function fetchAreas() {
  throw new NotImplementedError(
    'fetchAreas',
    'Sprint 4 (SSG Spec Phase D) — the `areas` table does not exist in Supabase yet'
  );
}

/**
 * Fetches published rows from the `developers` table (SSG Spec §3 /
 * Knowledge Architecture Part 1). Not implemented — the table itself
 * does not exist yet, in addition to this function.
 * @returns {Promise<Array<object>>}
 */
export async function fetchDevelopers() {
  throw new NotImplementedError(
    'fetchDevelopers',
    'Sprint 4 (SSG Spec Phase D) — the `developers` table does not exist in Supabase yet'
  );
}

/**
 * Fetches published rows from `blog_posts` for blog-page generation.
 * Not implemented — see Static Page Generator Spec Part 15, Phase C.
 * @returns {Promise<Array<object>>}
 */
export async function fetchPublishedBlogPosts() {
  throw new NotImplementedError('fetchPublishedBlogPosts', 'Sprint 2-3 (SSG Spec Phase C)');
}
