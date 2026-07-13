/**
 * generator/lib/aggregate-area.mjs
 * Aggregates normalized Property records (generator/lib/normalize-property.mjs)
 * into per-area statistics — property count, price range, property types —
 * per Static Page Generator Spec §3 / Knowledge Architecture Part 1 (Area
 * entity). Operates on already-normalized properties, not raw rows, reusing
 * the existing normalization pipeline rather than re-parsing raw fields.
 */
import { ValidationError } from './errors.mjs';

/**
 * Groups normalized properties by areaSlug and computes aggregate stats per group.
 * @param {Array<object>} properties Normalized Property records.
 * @returns {Map<string, {areaSlug: string, areaName: string, city: string, listingCount: number,
 *   priceMin: number|undefined, priceMax: number|undefined, propertyTypes: string[]}>}
 */
export function groupPropertiesByArea(properties) {
  const groups = new Map();

  for (const property of properties) {
    if (!property.areaSlug) continue;

    if (!groups.has(property.areaSlug)) {
      groups.set(property.areaSlug, {
        areaSlug: property.areaSlug,
        areaName: property.areaName,
        city: property.city,
        listingCount: 0,
        priceMin: undefined,
        priceMax: undefined,
        propertyTypes: new Set(),
      });
    }

    const group = groups.get(property.areaSlug);
    group.listingCount += 1;
    if (property.priceAed != null) {
      group.priceMin = group.priceMin == null ? property.priceAed : Math.min(group.priceMin, property.priceAed);
      group.priceMax = group.priceMax == null ? property.priceAed : Math.max(group.priceMax, property.priceAed);
    }
    if (property.propertyType) group.propertyTypes.add(property.propertyType);
  }

  for (const group of groups.values()) {
    group.propertyTypes = [...group.propertyTypes].sort();
  }

  return groups;
}

/**
 * @param {Map<string, object>} groups From groupPropertiesByArea().
 * @param {string} areaSlug
 * @returns {object} Aggregate stats for one area.
 */
export function getAreaAggregate(groups, areaSlug) {
  const group = groups.get(areaSlug);
  if (!group) {
    throw new ValidationError(`getAreaAggregate: no properties found for area slug "${areaSlug}".`);
  }
  return group;
}
