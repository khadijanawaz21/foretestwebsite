// PLACEHOLDER — not wired into any route, cron, or webhook yet.
//
// Property Finder's *listings* API is already integrated and working
// (api/sync-pf-listings.js, using PF_API_KEY/PF_API_SECRET against
// https://atlas.propertyfinder.com/v1/listings). Their *leads* endpoint
// has never been called from this codebase. Before this adapter can do
// anything real, confirm with the PF account manager:
//   - is the leads endpoint under the same Atlas API base, and is
//     PF_API_KEY/PF_API_SECRET (the existing pair) valid for it, or is
//     a separate credential required?
//   - the exact path/shape (this file assumes something like /v1/leads
//     returning { results: [...] }, mirroring the listings endpoint —
//     that is a guess, not a confirmed spec).
//
// Once confirmed, fill in fetchNewLeads() (reusing getPfToken()-style
// auth from api/sync-pf-listings.js) and correct the field mapping in
// normalize() to match the real payload.

const BASE_URL = process.env.PROPERTYFINDER_LEADS_API_BASE_URL;
const API_KEY = process.env.PF_API_KEY;
const API_SECRET = process.env.PF_API_SECRET;

// Normalizes a raw PF lead object into leads-table shape. Field names
// below are placeholders pending PF's real leads payload.
function normalize(raw) {
  return {
    source: 'propertyfinder',
    source_lead_id: String(raw.id ?? raw.leadId ?? ''),
    lead_type: raw.type || raw.leadType || 'unknown',
    full_name: raw.name || raw.contactName || '',
    email: raw.email || raw.contactEmail || null,
    phone: raw.phone || raw.contactPhone || null,
    property_id: raw.listingReference || raw.propertyReference || null,
    property_title: raw.propertyTitle || raw.listingTitle || null,
    message: raw.message || raw.note || null,
    details: raw,
  };
}

async function fetchNewLeads() {
  if (!BASE_URL || !API_KEY || !API_SECRET) {
    console.warn(
      '[crm/propertyfinder] not configured — PROPERTYFINDER_LEADS_API_BASE_URL / PF_API_KEY / PF_API_SECRET missing. Skipping.'
    );
    return [];
  }
  throw new Error('[crm/propertyfinder] fetchNewLeads() is a placeholder — confirm the real leads endpoint with PF before wiring this up.');
}

module.exports = { fetchNewLeads, normalize };
