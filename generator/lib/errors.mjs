/**
 * generator/lib/errors.mjs
 *
 * Shared, typed error classes for the FORE static page generator, so every
 * module raises errors consistently and callers (starting with build.mjs)
 * can distinguish "this isn't built yet" from "this is misconfigured" from
 * "this data failed validation" without parsing error message strings.
 */

/**
 * Thrown by any generator function whose real implementation is scheduled
 * for a future sprint. Sprint 1 intentionally ships module *structure*
 * (function signatures, JSDoc, wiring) without business logic — see the
 * Static Page Generator Specification, Part 15 (Phased Implementation Plan),
 * for which sprint/phase each stub belongs to.
 */
export class NotImplementedError extends Error {
  /**
   * @param {string} featureName What isn't implemented yet, e.g. "fetchAreas".
   * @param {string} [scheduledFor] Where it's scheduled, e.g. "Sprint 4 (SSG Spec Phase D)".
   */
  constructor(featureName, scheduledFor) {
    const suffix = scheduledFor ? ` Scheduled for: ${scheduledFor}.` : '';
    super(`${featureName} is not implemented yet.${suffix}`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Thrown when required configuration (typically an environment variable)
 * is missing or invalid. Callers in build.mjs catch this and log a warning
 * rather than crash, per Sprint 1's fail-open build policy — see build.mjs's
 * module doc comment for why.
 */
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Reserved for the build-time content validation pass described in the
 * Static Page Generator Specification §10 (e.g. a published Area with no
 * intro_copy, a page with duplicate meta description, malformed JSON-LD).
 * Not yet raised anywhere — generator/lib/validate.mjs is a placeholder
 * until real page generation exists to validate.
 */
export class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {unknown} [details] Structured detail about what failed validation.
   */
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}
