/**
 * generator/config.mjs
 *
 * Central configuration for the FORE static page generator ("fore-ssg").
 * Single responsibility: this is the *only* module that reads
 * environment-derived runtime settings via process.env. Every other
 * generator module should receive those settings from here (via the
 * exported `config` object), not read process.env itself — the one
 * documented exception is the SERVICE_KEY secret, explained below.
 *
 * No hardcoded configuration values live in this file. `config.siteUrl`
 * and `config.logLevel` are read straight from their environment
 * variables with no baked-in fallback string — if a variable is unset,
 * the corresponding field is simply `undefined`. Deciding what to do
 * about an absent value (warn, apply a local default, etc.) is each
 * consuming module's own responsibility, not this file's.
 *
 * SERVICE_KEY (the Supabase service-role secret) is deliberately NOT
 * included in `config` — it is read directly, once, inside
 * lib/supabase.mjs, to minimize the surface area where a secret value
 * could be accidentally logged or re-exported by anything importing this
 * module.
 *
 * PAGE_TYPES and SITEMAP_DEFAULTS below are a different kind of thing:
 * architectural registries already decided in the Static Page Generator
 * Specification (URL patterns §4/§14, sitemap priorities §7.3) — not
 * environment configuration, so they are literal data, not process.env
 * reads.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the repository root (one level above generator/). */
export const REPO_ROOT = path.resolve(__dirname, '..');

/** Absolute path to this generator/ directory. */
export const GENERATOR_ROOT = __dirname;

/**
 * Best-effort incremental-build cache (Static Page Generator Spec §9).
 * Gitignored — see .gitignore. Created at runtime if missing; never
 * committed, and the generator must remain correct if this directory is
 * empty or absent on any given build.
 */
export const CACHE_DIR = path.join(GENERATOR_ROOT, '.cache');
export const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json');
/** Per-build report (counts, warnings, errors) written by build.mjs — distinct from MANIFEST_PATH's future incremental-hash cache. */
export const BUILD_MANIFEST_PATH = path.join(CACHE_DIR, 'build-manifest.json');
/** sitemap.xml is written to the repo root so it's served at /sitemap.xml. Gitignored — regenerated every build. */
export const SITEMAP_PATH = path.join(REPO_ROOT, 'sitemap.xml');

/**
 * Environment-derived runtime settings, read live via getters (not
 * snapshotted at import time) so process.env changes made after this
 * module first loads — e.g. by a test's setup code, since ES module
 * imports are hoisted above other top-level statements — are respected.
 * No hardcoded fallback values. See module doc comment above.
 */
export const config = {
  get siteUrl() {
    return process.env.SITE_BASE_URL;
  },
  get logLevel() {
    return process.env.GENERATOR_LOG_LEVEL;
  },
  get supabaseUrl() {
    return process.env.SUPABASE_URL;
  },
};

/** Environment variables the generator depends on. See .env.example. */
export const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SERVICE_KEY'];
export const OPTIONAL_ENV_VARS = ['SITE_BASE_URL', 'GENERATOR_LOG_LEVEL'];

/**
 * Page-type registry — one entry per generated page type defined in the
 * Static Page Generator Specification (§6 Templating Engine, §14
 * Directory Layout) and the Knowledge Architecture (Part 3 Content
 * Architecture). `status: 'not_implemented'` for every entry in Sprint 1.
 */
export const PAGE_TYPES = {
  property: {
    label: 'Property',
    status: 'not_implemented',
    outputPathPattern: '/properties/{areaSlug}/{listingSlug}/',
    templateFile: path.join(GENERATOR_ROOT, 'templates', 'property.template.html'),
    derivedFrom: 'property-detail.html (repository root) — see Static Page Generator Spec §6',
    // TODO (Sprint 2, SSG Spec Phase B): marker-to-field map, meta rules
    // (§7.1), JSON-LD builder wiring (§7.2), legacy ?id= redirect map (§5).
  },
  area: {
    label: 'Area',
    status: 'not_implemented',
    outputPathPattern: '/areas/{areaSlug}/',
    templateFile: path.join(GENERATOR_ROOT, 'templates', 'area.template.html'),
    derivedFrom: 'new template, hand-designed — Knowledge Architecture Part 1 (Area entity)',
    // TODO (Sprint 4, SSG Spec Phase D): requires the `areas` Supabase
    // table (SSG Spec §3) to exist first — it does not yet.
  },
  developer: {
    label: 'Developer',
    status: 'not_implemented',
    outputPathPattern: '/developers/{developerSlug}/',
    templateFile: path.join(GENERATOR_ROOT, 'templates', 'developer.template.html'),
    derivedFrom: 'new template, hand-designed — Knowledge Architecture Part 1 (Developer entity)',
    // TODO (Sprint 4, SSG Spec Phase D): requires the `developers`
    // Supabase table (SSG Spec §3) to exist first — it does not yet.
  },
  blogPost: {
    label: 'Blog Post',
    status: 'not_implemented',
    outputPathPattern: '/blog/{postSlug}/',
    templateFile: path.join(GENERATOR_ROOT, 'templates', 'blog-post.template.html'),
    derivedFrom: 'blog-post.html (repository root) — see Static Page Generator Spec §6',
    // TODO (Sprint 2-3, SSG Spec Phase C): confirm/match blog-post.html's
    // existing client-side Markdown rendering (SSG Spec §16 open question).
  },
};

/**
 * Sitemap defaults per page type (Static Page Generator Spec §7.3). Not
 * consumed by anything yet in Sprint 1 — recorded here so the decision
 * is captured alongside the rest of the config.
 */
export const SITEMAP_DEFAULTS = {
  property: { changefreq: 'daily', priority: 0.8 },
  area: { changefreq: 'weekly', priority: 0.7 },
  developer: { changefreq: 'weekly', priority: 0.6 },
  blogPost: { changefreq: 'monthly', priority: 0.6 },
};
