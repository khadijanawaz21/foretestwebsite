/**
 * generator/lib/price-format.mjs
 * Single source for formatting a listing's price for display, shared by
 * the Unit Detail Page's stats row and its Similar Properties cards so
 * the two never disagree on formatting (e.g. the "/year" rent suffix).
 */
export function formatPriceLabel(priceAed, offeringType) {
  if (!priceAed) return 'Price on request';
  const amount = `AED ${Math.round(priceAed).toLocaleString('en-US')}`;
  return offeringType === 'rent' ? `${amount} / year` : amount;
}
