/**
 * generator/lib/sitemap.mjs
 *
 * sitemap.xml writer, per Static Page Generator Specification §7.3.
 * Single responsibility: given a flat list of URLs (with optional
 * changefreq/priority, see config.mjs's SITEMAP_DEFAULTS), produce valid
 * sitemap XML. Does not decide which URLs exist — build.mjs's future
 * orchestration loop (Sprint 2+) is responsible for collecting generated
 * + hand-written page URLs and passing them in here.
 *
 * STATUS (Sprint 1 — foundation): unimplemented. Designed from the start
 * to support splitting into a sitemap-index.xml + per-type sitemaps once
 * any single type approaches Google's 50,000-URL/50MB cap (Spec §7.3,
 * Knowledge Architecture Part 7) — that split is a config change to this
 * module's future implementation, not a rewrite, but is not needed at
 * today's page counts and is not built now.
 */
import { NotImplementedError } from './errors.mjs';

/**
 * @typedef {object} SitemapEntry
 * @property {string} url Absolute URL.
 * @property {string} [changefreq]
 * @property {number} [priority]
 * @property {string} [lastmod] ISO date string.
 */

/**
 * @param {SitemapEntry[]} entries
 * @returns {string} Valid sitemap XML.
 */
export function buildSitemapXml(entries) {
  throw new NotImplementedError('buildSitemapXml', 'Sprint 2 (SSG Spec Phase A)');
}

/**
 * Writes the given sitemap XML to disk at the repository root.
 * @param {string} xml
 * @param {string} [outputPath] Defaults to sitemap.xml at the repo root.
 * @returns {Promise<void>}
 */
export async function writeSitemap(xml, outputPath) {
  throw new NotImplementedError('writeSitemap', 'Sprint 2 (SSG Spec Phase A)');
}
