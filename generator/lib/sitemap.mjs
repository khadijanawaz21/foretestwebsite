/**
 * generator/lib/sitemap.mjs
 *
 * sitemap.xml builder, per Static Page Generator Specification §7.3.
 * Flat sitemap only — no sitemap index, no image entries, no blog/area/
 * developer URLs yet (SSG Spec Phase A scope only). Property URLs come
 * from runBatch's report (`report.succeededPages`) — the canonical URLs
 * of pages actually written in *this* build — never rediscovered by
 * scanning the properties/ output directory, so a failed or unpublished
 * listing can never leak in just because a stale file exists on disk.
 *
 * STATUS: implemented (Phase 3 — sitemap generation). Splitting into a
 * sitemap-index.xml + per-type sitemaps once a type approaches Google's
 * 50,000-URL/50MB cap (Spec §7.3, Knowledge Architecture Part 7) remains
 * a future config change to this module, not a rewrite — not needed at
 * today's page counts.
 */
import fs from 'node:fs';
import { config, SITEMAP_DEFAULTS, SITEMAP_PATH } from '../config.mjs';

/**
 * @typedef {object} SitemapEntry
 * @property {string} url Absolute URL.
 * @property {string} [changefreq]
 * @property {number} [priority]
 * @property {string} [lastmod] ISO date string.
 */

/**
 * Curated list of standalone static pages to include in the sitemap.
 * Deliberately explicit rather than derived from scanning the repo root
 * for *.html — that would sweep in internal tools (admin.html,
 * admin-posters.html) and page *templates* that aren't real standalone
 * URLs (blog-post.html, property-detail.html are rendered via query
 * params / the generator, not linkable pages in their own right).
 */
export const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/properties.html', changefreq: 'daily', priority: 0.9 },
  { path: '/blog.html', changefreq: 'daily', priority: 0.7 },
  { path: '/academy.html', changefreq: 'weekly', priority: 0.6 },
  { path: '/golden-visa.html', changefreq: 'monthly', priority: 0.6 },
  { path: '/contact.html', changefreq: 'monthly', priority: 0.5 },
  { path: '/careers.html', changefreq: 'monthly', priority: 0.3 },
  { path: '/privacy.html', changefreq: 'yearly', priority: 0.1 },
  { path: '/terms.html', changefreq: 'yearly', priority: 0.1 },
];

/**
 * Builds the deduplicated, ordered list of sitemap entries: static pages
 * first (in STATIC_PAGES order), then every successfully generated
 * property URL from the report. A URL already added by either source is
 * never added again. Pure — no I/O, no filesystem access.
 * @param {{succeededPages: Array<{canonicalUrl: string}>}} report runBatch() report
 * @param {Array<{path:string,changefreq:string,priority:number}>} [staticPages]
 * @returns {SitemapEntry[]}
 */
export function buildSitemapEntries(report, staticPages = STATIC_PAGES) {
  const seen = new Set();
  const entries = [];

  for (const page of staticPages) {
    const url = `${config.siteUrl}${page.path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ url, changefreq: page.changefreq, priority: page.priority });
  }

  for (const page of report.succeededPages) {
    const url = page.canonicalUrl;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({
      url,
      changefreq: SITEMAP_DEFAULTS.property.changefreq,
      priority: SITEMAP_DEFAULTS.property.priority,
    });
  }

  return entries;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {SitemapEntry[]} entries
 * @returns {string} Valid sitemap XML.
 */
export function buildSitemapXml(entries) {
  const urlTags = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${xmlEscape(e.url)}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlTags}\n</urlset>\n`;
}

/**
 * Writes the given sitemap XML to disk at the repository root.
 * @param {string} xml
 * @param {string} [outputPath] Defaults to sitemap.xml at the repo root.
 */
export function writeSitemap(xml, outputPath = SITEMAP_PATH) {
  fs.writeFileSync(outputPath, xml, 'utf8');
}
