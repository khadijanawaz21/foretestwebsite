/**
 * generator/lib/schema.mjs
 *
 * JSON-LD structured-data builders, per Static Page Generator
 * Specification §7.2 and FORE Knowledge Architecture Part 6 (AI Knowledge
 * Strategy — schema.org type table). Single responsibility: given a plain
 * data object for one entity, return a plain JS object ready to be
 * JSON.stringify'd into a page's <!--SSG:JSONLD--> marker. No HTML
 * handling, no data fetching — that's template-engine.mjs's and
 * supabase.mjs's job respectively.
 *
 * STATUS (Sprint 1 — foundation): unimplemented. Each builder's exact
 * output shape depends on which entity fields actually exist once the
 * Property/Area/Developer/Blog Article data model decisions in the
 * Knowledge Architecture are finalized in Supabase — building this now
 * would mean guessing at field names.
 */
import { NotImplementedError } from './errors.mjs';

/** @param {object} listing @returns {object} Residence/Apartment + Offer JSON-LD (Spec §7.2). */
export function buildRealEstateListingSchema(listing) {
  throw new NotImplementedError('buildRealEstateListingSchema', 'Sprint 2 (SSG Spec Phase B)');
}

/** @param {object} post @returns {object} Article JSON-LD (Spec §7.2). */
export function buildArticleSchema(post) {
  throw new NotImplementedError('buildArticleSchema', 'Sprint 2-3 (SSG Spec Phase C)');
}

/** @param {Array<{name: string, url: string}>} pathSegments @returns {object} BreadcrumbList JSON-LD (Spec §7.2). */
export function buildBreadcrumbSchema(pathSegments) {
  throw new NotImplementedError('buildBreadcrumbSchema', 'Sprint 2 (SSG Spec Phase B)');
}

/** @returns {object} Organization JSON-LD for FORE itself (Spec §7.2). */
export function buildOrganizationSchema() {
  throw new NotImplementedError('buildOrganizationSchema', 'Sprint 2 (SSG Spec Phase B)');
}

/** @param {Array<{question: string, answer: string}>} faqItems @returns {object} FAQPage JSON-LD (Spec §7.2). */
export function buildFAQSchema(faqItems) {
  throw new NotImplementedError('buildFAQSchema', 'Sprint 3 (SSG Spec Phase D, Knowledge Architecture Part 1 — FAQ entity)');
}
