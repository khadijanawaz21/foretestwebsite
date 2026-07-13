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
 * repo root — a production deployment artifact (like sitemap.xml), never
 * committed (see .gitignore). It is fetched here at request time, NOT
 * statically imported: Vercel's Edge Function bundler excludes gitignored
 * paths from a middleware's static-import trace regardless of what
 * buildCommand recreates there at build time or which directory the file
 * lives in — confirmed by two separate deploy failures (once from
 * generator/.cache/, once from the repo root) that only ever appeared to
 * be fixed when verified via a CLI upload, which bypasses git tracking
 * entirely. A runtime fetch of the file as an ordinary static asset (the
 * same mechanism serving sitemap.xml) has no such restriction. The parsed
 * index is cached in module scope so it survives across warm invocations
 * on the same isolate — a fresh deploy always spins up fresh isolates, so
 * there is no staleness risk. A fetch failure falls through to
 * property-detail.html unchanged rather than erroring the request.
 *
 * No Supabase query and no filesystem read — the Edge Runtime has no
 * `fs`. Decision logic itself lives in redirect-lookup.mjs (kept out of
 * generator/, which this phase must not modify) so it's unit-testable
 * under plain Node.
 */
import { buildRedirectIndex, resolveRedirectDestination } from './redirect-lookup.mjs';

export const config = {
  matcher: '/property-detail.html',
};

let redirectIndexPromise = null;

function getRedirectIndex(origin) {
  if (!redirectIndexPromise) {
    redirectIndexPromise = fetch(new URL('/redirect-manifest.json', origin))
      .then((res) => {
        if (!res.ok) throw new Error(`redirect-manifest.json fetch failed: ${res.status}`);
        return res.json();
      })
      .then(buildRedirectIndex)
      .catch((err) => {
        redirectIndexPromise = null; // allow a later request to retry instead of caching the failure forever
        throw err;
      });
  }
  return redirectIndexPromise;
}

export default async function middleware(request) {
  const requestUrl = new URL(request.url);

  let redirectIndex;
  try {
    redirectIndex = await getRedirectIndex(requestUrl.origin);
  } catch {
    return; // manifest unavailable this request — fall through rather than error
  }

  const destination = resolveRedirectDestination(requestUrl, redirectIndex);
  if (!destination) {
    return; // fall through to property-detail.html unchanged
  }
  return Response.redirect(destination, 301);
}
