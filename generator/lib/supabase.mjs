/**
 * generator/lib/supabase.mjs
 * Data access layer. Authenticates with the Supabase SERVICE ROLE key
 * (config.supabaseUrl for the URL; SERVICE_KEY read directly, since it's
 * a secret — see module rationale in generator/config.mjs).
 */
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.mjs';
import { ConfigError, DataFetchError, NotImplementedError } from './errors.mjs';
import { createLogger } from './logger.mjs';

const logger = createLogger('supabase');

let cachedClient = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
export function getServiceClient() {
  if (cachedClient) return cachedClient;

  const url = config.supabaseUrl;
  const serviceKey = process.env.SERVICE_KEY; // secret — read directly

  if (!url || !serviceKey) {
    throw new ConfigError('SUPABASE_URL and/or SERVICE_KEY are not set. See .env.example.');
  }

  cachedClient = createClient(url, serviceKey);
  logger.debug('Supabase service-role client created (no query executed yet).');
  return cachedClient;
}

/**
 * Fetches published rows from `secondary_listings`, newest first.
 * Off-plan (`offplan_listings`) fetching uses a different upstream shape
 * and is not covered here yet.
 * @param {{limit?: number}} [options]
 * @returns {Promise<Array<object>>}
 */
export async function fetchPublishedProperties({ limit } = {}) {
  const client = getServiceClient();
  let query = client
    .from('secondary_listings')
    .select('*')
    .eq('published', true)
    .not('dld_permit', 'is', null)
    .neq('dld_permit', '')
    .order('created_at', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    throw new DataFetchError(`fetchPublishedProperties: ${error.message}`);
  }
  return data || [];
}

/** @returns {Promise<Array<object>>} Not implemented — the `areas` table doesn't exist yet. */
export async function fetchAreas() {
  throw new NotImplementedError('fetchAreas', 'Sprint 4 (SSG Spec Phase D) — the `areas` table does not exist in Supabase yet');
}

/** @returns {Promise<Array<object>>} Not implemented — the `developers` table doesn't exist yet. */
export async function fetchDevelopers() {
  throw new NotImplementedError(
    'fetchDevelopers',
    'Sprint 4 (SSG Spec Phase D) — the `developers` table does not exist in Supabase yet'
  );
}

/** @returns {Promise<Array<object>>} Not implemented — see Static Page Generator Spec Part 15, Phase C. */
export async function fetchPublishedBlogPosts() {
  throw new NotImplementedError('fetchPublishedBlogPosts', 'Sprint 2-3 (SSG Spec Phase C)');
}
