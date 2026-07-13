/**
 * generator/lib/normalize-area.mjs
 * Builds the normalized Area entity (meta.mjs's AreaMetaInput / schema.mjs's
 * Place schema input) from an aggregate computed by
 * generator/lib/aggregate-area.mjs.
 *
 * IMPORTANT — interim content only: the `areas` Supabase table described in
 * the Static Page Generator Spec §3 (with a human-authored, REQUIRED
 * intro_copy field) does not exist yet. Until it does, introCopy here is a
 * data-derived sentence assembled from real aggregate stats — factual, not
 * fabricated, but not the unique editorial copy the anti-thin-content rule
 * (Spec §10 / Knowledge Architecture Part 3) actually calls for. Replace
 * this with real `areas.intro_copy` once that table and its content exist
 * (Phase D).
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
