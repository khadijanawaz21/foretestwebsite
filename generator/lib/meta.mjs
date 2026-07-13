/**
 * generator/lib/meta.mjs
 *
 * Title / meta-description generation rules, per Static Page Generator
 * Specification §7.1. Single responsibility: given a page type and an
 * entity's data, return generated title/description strings — with a
 * manual-override field always taking precedence, per the spec. No
 * schema, no HTML rendering — see schema.mjs and template-engine.mjs.
 *
 * STATUS (Sprint 1 — foundation): unimplemented. The exact per-page-type
 * rules (documented in Spec §7.1's table) depend on entity fields that
 * are only decided, not yet built, and on real listing/area/developer
 * data to test against.
 */
import { NotImplementedError } from './errors.mjs';

/**
 * @param {keyof import('../config.mjs').PAGE_TYPES} pageType
 * @param {object} entity Entity data (shape varies by pageType).
 * @returns {string} Generated (or manually-overridden) title, per Spec §7.1.
 */
export function generateTitle(pageType, entity) {
  throw new NotImplementedError('generateTitle', 'Sprint 2 (SSG Spec Phase A/B)');
}

/**
 * @param {keyof import('../config.mjs').PAGE_TYPES} pageType
 * @param {object} entity Entity data (shape varies by pageType).
 * @returns {string} Generated (or manually-overridden) meta description, per Spec §7.1.
 */
export function generateDescription(pageType, entity) {
  throw new NotImplementedError('generateDescription', 'Sprint 2 (SSG Spec Phase A/B)');
}
