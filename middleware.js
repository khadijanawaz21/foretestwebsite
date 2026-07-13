/**
 * middleware.js
 * Vercel Edge Middleware. 301-redirects legacy secondary-listing URLs
 * (property-detail.html?id={uuid}&type=secondary) to their generated
 * canonical static page (/properties/{areaSlug}/{listingSlug}/).
 *
 * Off-plan links (property-detail.html?id=... with no &type=secondary),
 * unknown ids, and missing/malformed ids fall through to
 * property-detail.html unchanged — this file is never modified or
 * removed by this middleware.
 *
 * The lookup table is the redirect manifest generator/build.mjs already
 * writes on every successful build (generator/lib/redirects.mjs) to the
 * repo root — a production deployment artifact (like sitemap.xml), not
 * a generator/.cache/ file — statically imported here so its contents
 * are inlined into the edge bundle at deploy time. It must live outside
 * generator/.cache/: that directory is gitignored, and Vercel's Edge
 * Function bundler excludes gitignored paths from a middleware's static
 * import trace regardless of what buildCommand recreates there at build
 * time. No Supabase query and no filesystem read at request time — the
 * Edge Runtime has no `fs`, and none is needed. Decision logic itself
 * lives in redirect-lookup.mjs (kept out of generator/, which this phase
 * must not modify) so it's unit-testable under plain Node.
 */
import redirectManifest from './redirect-manifest.json' with { type: 'json' };
import { buildRedirectIndex, resolveRedirectDestination } from './redirect-lookup.mjs';

export const config = {
  matcher: '/property-detail.html',
};

const redirectIndex = buildRedirectIndex(redirectManifest);

export default function middleware(request) {
  const destination = resolveRedirectDestination(new URL(request.url), redirectIndex);
  if (!destination) {
    return; // fall through to property-detail.html unchanged
  }
  return Response.redirect(destination, 301);
}
