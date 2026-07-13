/**
 * generator/lib/normalize-area.mjs
 * Builds the normalized Area entity (meta.mjs's AreaMetaInput / schema.mjs's
 * Place schema input) from an aggregate computed by
 * generator/lib/aggregate-area.mjs.
 *
 * IMPORTANT — interim content only: the `areas`/`area_translations` schema
 * (scripts/create-areas-table.sql, scripts/migration-area-i18n-and-revisions.sql)
 * has been designed but not yet applied to the live Supabase project, and
 * has no rows either way. Until it's populated, introCopy here is a
 * data-derived sentence assembled from real aggregate stats — factual, not
 * fabricated, but not the unique editorial copy the anti-thin-content rule
 * (Spec §10 / Knowledge Architecture Part 3) actually calls for. Replace
 * this with real `area_translations.intro_copy` (locale='en', or the
 * request's locale once i18n is wired up) once that table has content
 * (Phase D). Note intro_copy now lives in `area_translations`, not on
 * `areas` directly — see the i18n migration.
 */
import { ValidationError } from './errors.mjs';

function buildInterimIntroCopy(aggregate) {
  if (!aggregate.listingCount) {
    throw new ValidationError(`buildInterimIntroCopy: area "${aggregate.areaName}" has no listings to summarize.`);
  }
  const typesPhrase = aggregate.propertyTypes.length
    ? ` including ${aggregate.propertyTypes.join(', ').toLowerCase()}`
    : '';
  return (
    `${aggregate.areaName} is a Dubai real estate community currently listing ${aggregate.listingCount} ` +
    `propert${aggregate.listingCount === 1 ? 'y' : 'ies'} with FORE${typesPhrase}.`
  );
}

/**
 * @param {object} aggregate From generator/lib/aggregate-area.mjs's getAreaAggregate().
 * @returns {object} Normalized Area entity.
 */
export function buildAreaEntity(aggregate) {
  return {
    slug: aggregate.areaSlug,
    name: aggregate.areaName,
    city: aggregate.city,
    listingCount: aggregate.listingCount,
    priceMin: aggregate.priceMin,
    priceMax: aggregate.priceMax,
    propertyTypes: aggregate.propertyTypes,
    introCopy: buildInterimIntroCopy(aggregate),
  };
}
