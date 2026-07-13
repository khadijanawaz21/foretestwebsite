/**
 * generator/lib/validate.mjs
 *
 * Build-time content-quality validation pass, per Static Page Generator
 * Specification §10 (anti-thin-content safeguards). Single responsibility:
 * inspect a batch of already-generated pages/entities and report problems
 * (missing/duplicate title or description, empty required editorial copy,
 * malformed JSON-LD, anomalous page-count swings). Does not generate or
 * fix anything itself — it only reports, via ValidationError, so build.mjs
 * can decide whether to fail the build.
 *
 * STATUS (Sprint 1 — foundation): unimplemented. There is nothing to
 * validate yet, since no pages are generated in this sprint. This module
 * exists now so the folder structure matches the spec and so later
 * sprints have an obvious place to add checks as each rule becomes
 * relevant, rather than validation logic accreting inside build.mjs.
 */
import { NotImplementedError } from './errors.mjs';

/**
 * @typedef {object} ValidationIssue
 * @property {'error' | 'warning'} severity
 * @property {string} message
 * @property {string} [outputPath]
 */

/**
 * @param {Array<{ pageType: string, outputPath: string, title: string, description: string, jsonLd: unknown }>} generatedPages
 * @returns {ValidationIssue[]}
 */
export function validateGeneratedPages(generatedPages) {
  throw new NotImplementedError('validateGeneratedPages', 'Sprint 4 (SSG Spec §10) — nothing to validate before Phase D exists');
}
