// PLACEHOLDER — not wired into any route, cron, or webhook yet.
//
// Bayut support has issued a "WhatsApp push API Key" (see the Aug 2026
// support thread — request #4058843), but the mechanics are unconfirmed:
//   - is this key for polling a Bayut/BeHomes endpoint, or a shared
//     secret to validate an inbound webhook Bayut calls?
//   - the thread also referenced https://api.behomes.tech/v4/dubizzle/
//     web_hook/ — BeHomes (FORE's current CRM) may be the actual
//     intermediary for Bayut leads rather than Bayut delivering directly.
//     If confirmed, build shared/crm/adapters/behomes.js against that
//     endpoint instead of pointing this file at Bayut directly.
// Do not wire this up until that's resolved with Bayut/BeHomes support.

const BASE_URL = process.env.BAYUT_API_BASE_URL;
const API_KEY = process.env.BAYUT_API_KEY;

// Normalizes a raw Bayut lead object into leads-table shape. Field names
// below are placeholders pending Bayut's real leads payload.
function normalize(raw) {
  return {
    source: 'bayut',
    source_lead_id: String(raw.id ?? raw.lead_id ?? raw.leadId ?? ''),
    lead_type: raw.type || raw.lead_type || 'unknown',
    full_name: raw.name || raw.contact_name || raw.customer_name || '',
    email: raw.email || raw.contact_email || raw.customer_email || null,
    phone: raw.phone || raw.contact_phone || raw.customer_phone || null,
    property_id: raw.reference || raw.property_reference || raw.listing_id || null,
    property_title: raw.property_title || raw.listing_title || null,
    message: raw.message || raw.note || null,
    details: raw,
  };
}

async function fetchNewLeads() {
  if (!BASE_URL || !API_KEY) {
    console.warn('[crm/bayut] not configured — BAYUT_API_BASE_URL / BAYUT_API_KEY missing. Skipping.');
    return [];
  }
  throw new Error('[crm/bayut] fetchNewLeads() is a placeholder — confirm the real delivery model (push vs. poll, and whether BeHomes sits in between) before wiring this up.');
}

module.exports = { fetchNewLeads, normalize };
