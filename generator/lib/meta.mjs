/**
 * generator/lib/meta.mjs
 * Title / meta-description generation (Static Page Generator Spec §7.1).
 * Operates on normalized entity shapes (not raw Supabase rows) — mapping
 * raw rows to these shapes is the caller's responsibility.
 *
 * @typedef {object} PropertyMetaInput
 * @property {number} [bedrooms] 0/undefined = studio.
 * @property {string} propertyType
 * @property {'sale'|'rent'} [offeringType]
 * @property {string} buildingName
 * @property {string} areaName
 * @property {number} [priceAed]
 * @property {number} [areaSqft]
 * @property {number|string} [handoverYear]
 * @property {string} [description]
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
const TITLE_MAX_RECOMMENDED = 60;
const DESCRIPTION_MAX_RECOMMENDED = 160;

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

function warnIfTooLong(kind, text, max) {
  if (text.length > max) {
    logger.warn(`Generated ${kind} exceeds recommended length (${text.length} > ${max} chars): "${text}"`);
  }
}

function truncateAtWordBoundary(text, maxLength) {
  const clean = String(text).trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced}…`;
}

function firstSentence(text) {
  const match = String(text).trim().match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : String(text).trim();
}

function formatMoney(value) {
  return `AED ${Math.round(value).toLocaleString('en-US')}`;
}

function buildPropertyTitle(entity) {
  const bedroomLabel = !entity.bedrooms ? 'Studio' : `${entity.bedrooms}BR`;
  const propertyType = requireField(entity, 'propertyType');
  const offering = entity.offeringType === 'rent' ? 'Rent' : 'Sale';
  const building = requireField(entity, 'buildingName');
  const area = requireField(entity, 'areaName');
  return `${bedroomLabel} ${propertyType} for ${offering} in ${building}, ${area} | FORE`;
}

function buildPropertyDescription(entity) {
  const facts = [];
  if (entity.priceAed) facts.push(`From ${formatMoney(entity.priceAed)}`);
  if (entity.areaSqft) facts.push(`${Math.round(entity.areaSqft).toLocaleString('en-US')} sq ft`);
  if (entity.handoverYear) facts.push(`handover ${entity.handoverYear}`);
  const factSentence = facts.length ? `${facts.join(', ')}.` : '';
  const excerpt = truncateAtWordBoundary(entity.description || '', 140);
  return [factSentence, excerpt].filter(Boolean).join(' ').trim();
}

function buildAreaDescription(entity) {
  const name = requireField(entity, 'name');
  const stats = [];
  if (entity.listingCount != null) stats.push(`${entity.listingCount} propert${entity.listingCount === 1 ? 'y' : 'ies'}`);
  if (entity.priceMin && entity.priceMax) stats.push(`from ${formatMoney(entity.priceMin)} to ${formatMoney(entity.priceMax)}`);
  const statSentence = stats.length ? `Explore ${stats.join(', ')} in ${name}.` : `Explore properties in ${name}.`;
  const introExcerpt = entity.introCopy ? ` ${firstSentence(entity.introCopy)}` : '';
  return truncateAtWordBoundary(`${statSentence}${introExcerpt}`, DESCRIPTION_MAX_RECOMMENDED);
}

function buildDeveloperDescription(entity) {
  const name = requireField(entity, 'name');
  const projectPhrase = entity.projectCount != null ? ` with ${entity.projectCount} project${entity.projectCount === 1 ? '' : 's'} in Dubai` : '';
  const introExcerpt = entity.introCopy ? ` ${firstSentence(entity.introCopy)}` : '';
  return truncateAtWordBoundary(`${name}${projectPhrase}.${introExcerpt}`, DESCRIPTION_MAX_RECOMMENDED);
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
  warnIfTooLong('title', title, TITLE_MAX_RECOMMENDED);
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
  warnIfTooLong('description', description, DESCRIPTION_MAX_RECOMMENDED);
  return description;
}
