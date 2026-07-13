/**
 * generator/lib/validate.mjs
 * Build-time content-quality validation (Static Page Generator Spec §10).
 * Pure reporting function — never fails the build itself; the caller
 * decides based on whether any returned issue has severity 'error'.
 *
 * @typedef {object} GeneratedPageRecord
 * @property {string} pageType
 * @property {string} outputPath
 * @property {string} title
 * @property {string} description
 * @property {object} [jsonLd]
 * @property {{introCopy?: string}} [entity] Checked for required editorial copy on area/developer pages.
 *
 * @typedef {object} ValidationIssue
 * @property {'error'|'warning'} severity
 * @property {string} message
 * @property {string} [outputPath]
 */
import { ValidationError } from './errors.mjs';

const PAGE_TYPES_REQUIRING_INTRO_COPY = ['area', 'developer'];
const COUNT_SWING_THRESHOLD = 0.3;

function checkNonEmpty(issues, page, field) {
  const value = page[field];
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push({ severity: 'error', message: `Page is missing a ${field}.`, outputPath: page.outputPath });
  }
}

function checkDuplicate(issues, seen, page, field) {
  const value = page[field];
  if (typeof value !== 'string' || value.trim() === '') return; // already reported by checkNonEmpty
  const key = value.trim().toLowerCase();
  if (seen.has(key)) {
    issues.push({
      severity: 'error',
      message: `Duplicate ${field} "${value}" also used by ${seen.get(key)}.`,
      outputPath: page.outputPath,
    });
  } else {
    seen.set(key, page.outputPath);
  }
}

function checkJsonLd(issues, page) {
  if (page.jsonLd === undefined) return; // not every page type requires JSON-LD
  try {
    const parsed = JSON.parse(JSON.stringify(page.jsonLd));
    if (!parsed || !parsed['@context'] || !parsed['@type']) {
      issues.push({
        severity: 'error',
        message: 'JSON-LD is missing required "@context" or "@type".',
        outputPath: page.outputPath,
      });
    }
  } catch (err) {
    issues.push({ severity: 'error', message: `JSON-LD failed to serialize: ${err.message}`, outputPath: page.outputPath });
  }
}

function checkIntroCopy(issues, page) {
  if (!PAGE_TYPES_REQUIRING_INTRO_COPY.includes(page.pageType)) return;
  const introCopy = page.entity && page.entity.introCopy;
  if (typeof introCopy !== 'string' || introCopy.trim() === '') {
    issues.push({
      severity: 'error',
      message: `Published "${page.pageType}" page has no intro_copy (required, SSG Spec §10).`,
      outputPath: page.outputPath,
    });
  }
}

function checkCountSwings(issues, currentCounts, previousCounts) {
  for (const [pageType, previous] of Object.entries(previousCounts)) {
    if (!previous) continue;
    const current = currentCounts[pageType] || 0;
    const change = Math.abs(current - previous) / previous;
    if (change > COUNT_SWING_THRESHOLD) {
      issues.push({
        severity: 'warning',
        message: `Page count for "${pageType}" changed by ${(change * 100).toFixed(0)}% (from ${previous} to ${current}).`,
      });
    }
  }
}

/**
 * @param {GeneratedPageRecord[]} generatedPages
 * @param {Record<string, number>} [previousCounts] Prior build's page count per pageType; enables the count-swing check.
 * @returns {ValidationIssue[]}
 */
export function validateGeneratedPages(generatedPages, previousCounts) {
  if (!Array.isArray(generatedPages)) {
    throw new ValidationError('validateGeneratedPages requires an array of generated page records.');
  }

  const issues = [];
  const seenTitles = new Map();
  const seenDescriptions = new Map();
  const countsByType = {};

  for (const page of generatedPages) {
    countsByType[page.pageType] = (countsByType[page.pageType] || 0) + 1;
    checkNonEmpty(issues, page, 'title');
    checkNonEmpty(issues, page, 'description');
    checkDuplicate(issues, seenTitles, page, 'title');
    checkDuplicate(issues, seenDescriptions, page, 'description');
    checkJsonLd(issues, page);
    checkIntroCopy(issues, page);
  }

  if (previousCounts) {
    checkCountSwings(issues, countsByType, previousCounts);
  }

  return issues;
}
