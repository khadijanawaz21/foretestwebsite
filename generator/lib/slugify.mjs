/**
 * generator/lib/slugify.mjs
 *
 * Deterministic slug generation, per Static Page Generator Specification
 * §4 (URL & Slug Strategy) — lowercase, transliterate, hyphenate, strip
 * punctuation, with a mandatory short suffix for entities (like Property)
 * whose display name alone is not unique.
 *
 * STATUS (Sprint 1 — foundation): intentionally left unimplemented. The
 * algorithm itself is simple, but two things it depends on don't exist
 * yet: (1) real listing/area/developer data to slugify (Sprint 2+), and
 * (2) the in-memory "slugs already used this build" collision-tracking
 * set, which lives in build.mjs's orchestration loop and is only
 * meaningful once that loop actually generates pages. Implementing this
 * now, in isolation, would mean guessing at the collision-handling
 * contract rather than building it against real orchestration code.
 */
import { NotImplementedError } from './errors.mjs';

/**
 * @param {string} input Raw text to slugify (e.g. a building or area name).
 * @param {{ suffix?: string }} [options] Optional short, stable suffix
 *   (e.g. the last 5-6 characters of a database id) to guarantee
 *   uniqueness among colliding display names — see Static Page Generator
 *   Spec §4 for why this is required for Property slugs specifically.
 * @returns {string}
 */
export function slugify(input, options) {
  throw new NotImplementedError('slugify', 'Sprint 2 (SSG Spec Phase A)');
}
