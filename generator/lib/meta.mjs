/**
 * generator/lib/meta.mjs
 * Title / meta-description generation (Static Page Generator Spec §7.1).
 * Operates on normalized entity shapes (not raw Supabase rows) — mapping
 * raw rows to these shapes is the caller's responsibility.
 *
 * Titles are built ONLY from structured fields (property type, bedrooms,
 * project/building, community/area, transaction type) — never from a raw
 * listing headline (e.g. `name`/ad-copy text). See
 * generator/lib/normalize-property.mjs for why `buildingName`/`projectName`
 * are never backfilled from that kind of field.
 *
 * @typedef {object} PropertyMetaInput
 * @property {number} [bedrooms] 0/undefined = studio.
 * @property {string} propertyType
 * @property {'sale'|'rent'} [offeringType]
 * @property {string} [projectName] Preferred "place" identifier, if known.
 * @property {string} [buildingName] Fallback "place" identifier.
 * @property {string} areaName Community/area name.
 * @property {string} [city]
 * @property {number} [priceAed]
 * @property {number} [areaSqft]
 * @property {number|string} [handoverYear]
 * @property {string} [description] Full listing description (used for the meta description excerpt only).
 * @property {string} [metaTitleOverride]
 * @property {string} [metaDescriptionOverride]
 *
 * @typedef {object} AreaMetaInput
 * @property {string} name
 * @property {number} [listingCount]
 * @property {number} [priceMin]
 * @property {number} [priceMax]
 * @property {string} [introCopy]
 * @property {string} [metaTitle]
 * @property {string} [metaDescription]
 *
 * @typedef {object} DeveloperMetaInput
 * @property {string} name
 * @property {number} [projectCount]
 * @property {string} [introCopy]
 * @property {string} [metaTitle]
 * @property {string} [metaDescription]
 *
 * @typedef {object} BlogMetaInput
 * @property {string} title
 * @property {string} excerpt
 */
import { MetaGenerationError } from './errors.mjs';
import { createLogger } from './logger.mjs';

const logger = createLogger('meta');

const TITLE_MIN = 50;
const TITLE_MAX = 65;
const BRAND_SUFFIX = 'FORE';

const DESCRIPTION_MIN = 140;
const DESCRIPTION_MAX = 160;

function requireField(entity, field) {
  const value = entity[field];
  if (value === undefined || value === null || value === '') {
    throw new MetaGenerationError(`Missing required field "${field}" on entity for meta generation.`);
  }
  return value;
}

function assertEntity(entity) {
  if (!entity || typeof entity !== 'object') {
    throw new MetaGenerationError('entity must be an object.');
  }
}

/** Warns if text exceeds max; logs (does not warn) if shorter than the ideal min — a short but accurate value is acceptable. */
function warnIfOutsideRange(kind, text, min, max) {
  if (text.length > max) {
    logger.warn(`Generated ${kind} exceeds max length (${text.length} > ${max} chars): "${text}"`);
  } else if (text.length < min) {
    logger.debug(`Generated ${kind} is shorter than the ideal minimum (${text.length} < ${min} chars): "${text}"`);
  }
}

/**
 * Truncates at the last word boundary at or before maxLength.
 * @param {string} text
 * @param {number} maxLength
 * @param {{ellipsis?: string}} [options] Suffix appended when trimmed (default '…'; pass '' for none).
 */
function truncateAtWordBoundary(text, maxLength, { ellipsis = '…' } = {}) {
  const clean = String(text).trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength - ellipsis.length);
  const lastSpace = sliced.lastIndexOf(' ');
  const safe = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${safe}${ellipsis}`;
}

function firstSentence(text) {
  const match = String(text).trim().match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : String(text).trim();
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function formatMoney(value) {
  return `AED ${Math.round(value).toLocaleString('en-US')}`;
}

/** The "place" component of a property title/description: project name preferred over building name. Never the raw listing headline. */
function resolvePlaceName(entity) {
  return entity.projectName || entity.buildingName || undefined;
}

function buildPropertyTitleDescriptive(entity) {
  const bedroomLabel = entity.bedrooms === 0 ? 'Studio' : entity.bedrooms ? `${entity.bedrooms}BR` : '';
  const propertyType = requireField(entity, 'propertyType');
  const offering = entity.offeringType === 'rent' ? 'Rent' : 'Sale';
  const area = requireField(entity, 'areaName');
  const place = resolvePlaceName(entity);

  const typeLabel = [bedroomLabel, propertyType].filter(Boolean).join(' ');
  const locationLabel = place ? `${place}, ${area}` : area;
  return `${typeLabel} for ${offering} in ${locationLabel}`;
}

function buildPropertyTitle(entity) {
  const suffixLength = ` | ${BRAND_SUFFIX}`.length;
  const budget = TITLE_MAX - suffixLength;

  let descriptive = buildPropertyTitleDescriptive(entity);

  // Below the ideal minimum: try adding the city for extra specificity, if
  // it isn't already implied and there's room — never fabricate content.
  if (descriptive.length < TITLE_MIN && entity.city && !descriptive.includes(entity.city)) {
    const extended = `${descriptive}, ${entity.city}`;
    if (extended.length <= budget) descriptive = extended;
  }

  if (descriptive.length > budget) {
    descriptive = truncateAtWordBoundary(descriptive, budget, { ellipsis: '' });
  }

  return `${descriptive} | ${BRAND_SUFFIX}`;
}

function buildPropertyIntro(entity) {
  const bedroomLabel = entity.bedrooms === 0 ? 'Studio' : entity.bedrooms ? `${entity.bedrooms}-bedroom` : '';
  const propertyType = (entity.propertyType || 'property').toLowerCase();
  const offeringPhrase = entity.offeringType === 'rent' ? 'for rent' : 'for sale';
  const place = resolvePlaceName(entity);

  const typeLabel = [bedroomLabel, propertyType].filter(Boolean).join(' ');
  let intro = `${capitalize(typeLabel)} ${offeringPhrase}`;
  if (place) intro += ` in ${place}`;
  if (entity.areaName) intro += `, ${entity.areaName}`;
  return `${intro}.`;
}

function buildPropertyFactSentence(entity) {
  const facts = [];
  if (entity.priceAed) facts.push(formatMoney(entity.priceAed));
  if (entity.areaSqft) facts.push(`${Math.round(entity.areaSqft).toLocaleString('en-US')} sq ft`);
  if (entity.handoverYear) facts.push(`handover ${entity.handoverYear}`);
  return facts.length ? ` ${facts.join(', ')}.` : '';
}

function buildPropertyDescription(entity) {
  let result = `${buildPropertyIntro(entity)}${buildPropertyFactSentence(entity)}`;

  // Fill toward the target window using the listing's own description —
  // never fabricated text, and never the raw ad-style `name` field.
  if (entity.description) {
    const remaining = DESCRIPTION_MAX - result.length - 1;
    if (remaining > 20) {
      result = `${result} ${truncateAtWordBoundary(entity.description, remaining)}`;
    }
  }

  return result.length > DESCRIPTION_MAX ? truncateAtWordBoundary(result, DESCRIPTION_MAX) : result;
}

function buildAreaDescription(entity) {
  const name = requireField(entity, 'name');
  const stats = [];
  if (entity.listingCount != null) stats.push(`${entity.listingCount} propert${entity.listingCount === 1 ? 'y' : 'ies'}`);
  if (entity.priceMin && entity.priceMax) stats.push(`from ${formatMoney(entity.priceMin)} to ${formatMoney(entity.priceMax)}`);
  const statSentence = stats.length ? `Explore ${stats.join(', ')} in ${name}.` : `Explore properties in ${name}.`;
  const introExcerpt = entity.introCopy ? ` ${firstSentence(entity.introCopy)}` : '';
  return truncateAtWordBoundary(`${statSentence}${introExcerpt}`, DESCRIPTION_MAX);
}

function buildDeveloperDescription(entity) {
  const name = requireField(entity, 'name');
  const projectPhrase = entity.projectCount != null ? ` with ${entity.projectCount} project${entity.projectCount === 1 ? '' : 's'} in Dubai` : '';
  const introExcerpt = entity.introCopy ? ` ${firstSentence(entity.introCopy)}` : '';
  return truncateAtWordBoundary(`${name}${projectPhrase}.${introExcerpt}`, DESCRIPTION_MAX);
}

/**
 * @param {'property'|'area'|'developer'|'blogPost'} pageType
 * @param {PropertyMetaInput|AreaMetaInput|DeveloperMetaInput|BlogMetaInput} entity
 * @returns {string}
 */
export function generateTitle(pageType, entity) {
  assertEntity(entity);
  let title;
  switch (pageType) {
    case 'property':
      title = entity.metaTitleOverride || buildPropertyTitle(entity);
      break;
    case 'area':
      title = entity.metaTitle || `Properties for Sale in ${requireField(entity, 'name')}, Dubai | FORE`;
      break;
    case 'developer':
      title = entity.metaTitle || `${requireField(entity, 'name')} Properties in Dubai | FORE`;
      break;
    case 'blogPost':
      title = requireField(entity, 'title');
      break;
    default:
      throw new MetaGenerationError(`generateTitle: unknown pageType "${pageType}".`);
  }
  warnIfOutsideRange('title', title, TITLE_MIN, TITLE_MAX);
  return title;
}

/**
 * @param {'property'|'area'|'developer'|'blogPost'} pageType
 * @param {PropertyMetaInput|AreaMetaInput|DeveloperMetaInput|BlogMetaInput} entity
 * @returns {string}
 */
export function generateDescription(pageType, entity) {
  assertEntity(entity);
  let description;
  switch (pageType) {
    case 'property':
      description = entity.metaDescriptionOverride || buildPropertyDescription(entity);
      break;
    case 'area':
      description = entity.metaDescription || buildAreaDescription(entity);
      break;
    case 'developer':
      description = entity.metaDescription || buildDeveloperDescription(entity);
      break;
    case 'blogPost':
      description = requireField(entity, 'excerpt');
      break;
    default:
      throw new MetaGenerationError(`generateDescription: unknown pageType "${pageType}".`);
  }
  warnIfOutsideRange('description', description, DESCRIPTION_MIN, DESCRIPTION_MAX);
  return description;
}
