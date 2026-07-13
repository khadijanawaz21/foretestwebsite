/**
 * redirect-lookup.mjs
 * Pure, framework-independent redirect resolution logic used by
 * middleware.js. No I/O, no Vercel/edge-specific APIs, no Supabase —
 * just Map lookups against the redirect manifest generator/build.mjs
 * already writes (generator/lib/redirects.mjs). Kept outside generator/
 * (which this phase must not modify) and separate from middleware.js
 * itself so it's testable under plain Node.
 */

/**
 * Builds an id -> canonical_url lookup Map from a redirect manifest.
 * @param {{redirects?: Array<{id: string|number, canonical_url: string}>}} manifest
 * @returns {Map<string, string>}
 */
export function buildRedirectIndex(manifest) {
  const entries = manifest && Array.isArray(manifest.redirects) ? manifest.redirects : [];
  return new Map(entries.map((entry) => [String(entry.id), entry.canonical_url]));
}

/**
 * Decides the redirect destination for an incoming property-detail.html
 * request, or null if the request should fall through to the existing
 * page unchanged — covers off-plan links (no &type=secondary), unknown
 * ids, and missing/malformed ids. Any query parameters on the incoming
 * URL other than `id`/`type` are carried over onto the destination.
 * @param {URL} requestUrl
 * @param {Map<string, string>} redirectIndex
 * @returns {string|null}
 */
export function resolveRedirectDestination(requestUrl, redirectIndex) {
  const type = requestUrl.searchParams.get('type');
  const id = requestUrl.searchParams.get('id');

  if (type !== 'secondary' || !id) {
    return null;
  }

  const canonicalUrl = redirectIndex.get(id);
  if (!canonicalUrl) {
    return null;
  }

  const destination = new URL(canonicalUrl);
  for (const [key, value] of requestUrl.searchParams) {
    if (key === 'id' || key === 'type') continue;
    destination.searchParams.set(key, value);
  }

  return destination.toString();
}
