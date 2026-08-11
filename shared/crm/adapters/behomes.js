// PLACEHOLDER — not wired into any route, cron, or webhook yet.
//
// FORE's off-plan listings sync (api/sync-listings.js) already talks to
// BeHomes (api.behomes.tech/v3/get_behomes_objects) for project data.
// The user has confirmed BeHomes is FORE's *current CRM*, but it is
// unconfirmed whether it already aggregates Bayut/Property Finder leads
// (a Bayut support thread referenced a
// https://api.behomes.tech/v4/dubizzle/web_hook/ URL, which suggests it
// might). If BeHomes turns out to be the real intermediary, this
// adapter — not separate bayut.js/propertyfinder.js adapters — becomes
// the single source for both portals' leads. Confirm with BeHomes
// support before filling this in: does it expose a leads-read endpoint
// alongside get_behomes_objects, and what does that dubizzle webhook
// path actually feed?

const BASE_URL = process.env.BEHOMES_LEADS_API_BASE_URL;
const API_KEY = process.env.BEHOMES_API_KEY;

// Normalizes a raw BeHomes lead object into leads-table shape. Entirely
// speculative — no confirmed payload shape exists yet.
function normalize(raw) {
  return {
    source: raw.portal_source === 'bayut' ? 'bayut' : 'propertyfinder',
    source_lead_id: String(raw.id ?? raw.lead_id ?? ''),
    lead_type: raw.type || 'unknown',
    full_name: raw.name || raw.contact_name || '',
    email: raw.email || null,
    phone: raw.phone || null,
    property_id: raw.project_id || raw.property_reference || null,
    property_title: raw.property_title || null,
    message: raw.message || null,
    details: raw,
  };
}

async function fetchNewLeads() {
  if (!BASE_URL || !API_KEY) {
    console.warn('[crm/behomes] not configured — BEHOMES_LEADS_API_BASE_URL / BEHOMES_API_KEY missing. Skipping.');
    return [];
  }
  throw new Error('[crm/behomes] fetchNewLeads() is a placeholder — confirm whether BeHomes actually aggregates portal leads before wiring this up.');
}

module.exports = { fetchNewLeads, normalize };
