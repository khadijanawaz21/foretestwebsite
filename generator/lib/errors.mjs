/**
 * generator/lib/errors.mjs
 *
 * Shared, typed error classes for the FORE static page generator, so
 * every module raises errors consistently and callers can distinguish
 * failure kinds without parsing message strings.
 */

/** Raised by a function whose implementation is scheduled for a future sprint. */
export class NotImplementedError extends Error {
  /** @param {string} featureName @param {string} [scheduledFor] */
  constructor(featureName, scheduledFor) {
    const suffix = scheduledFor ? ` Scheduled for: ${scheduledFor}.` : '';
    super(`${featureName} is not implemented yet.${suffix}`);
    this.name = 'NotImplementedError';
  }
}

/** Raised when required configuration (e.g. an environment variable) is missing or invalid. */
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Raised by the build-time content validation pass (Static Page Generator Spec §10). */
export class ValidationError extends Error {
  /** @param {string} message @param {unknown} [details] */
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/** Raised by generator/lib/slugify.mjs for invalid input. */
export class SlugError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SlugError';
  }
}

/** Raised by generator/lib/template-engine.mjs for malformed templates or missing marker data. */
export class TemplateRenderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TemplateRenderError';
  }
}

/** Raised by generator/lib/meta.mjs when required entity fields are missing. */
export class MetaGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MetaGenerationError';
  }
}

/** Raised by generator/lib/schema.mjs when required entity fields are missing or invalid. */
export class SchemaBuildError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchemaBuildError';
  }
}

/** Raised by generator/lib/supabase.mjs when a query fails. */
export class DataFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataFetchError';
  }
}
