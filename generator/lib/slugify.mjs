/**
 * generator/lib/slugify.mjs
 * Deterministic slug generation (Static Page Generator Spec §4).
 */
import { SlugError } from './errors.mjs';

const DEFAULT_MAX_LENGTH = 80;

/**
 * @param {string} input Raw text (e.g. a building or area name).
 * @param {{suffix?: string, maxLength?: number}} [options]
 *   suffix: short, stable string appended for uniqueness (e.g. an id fragment).
 *   maxLength: max length of the base segment before the suffix. Default 80.
 * @returns {string}
 */
export function slugify(input, options = {}) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new SlugError('slugify: "input" must be a non-empty string.');
  }

  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new SlugError('slugify: "options.maxLength" must be a positive integer.');
  }

  let base = toSlugSegment(input);
  if (!base) {
    throw new SlugError(`slugify: input "${input}" contains no sluggable characters.`);
  }
  if (base.length > maxLength) {
    base = trimToWholeSegment(base, maxLength);
  }

  const suffix = options.suffix ? toSlugSegment(String(options.suffix)) : '';
  return suffix ? `${base}-${suffix}` : base;
}

function toSlugSegment(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (e.g. "é" -> "e")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function trimToWholeSegment(slug, maxLength) {
  const sliced = slug.slice(0, maxLength);
  const lastHyphen = sliced.lastIndexOf('-');
  return lastHyphen > 0 ? sliced.slice(0, lastHyphen) : sliced;
}
