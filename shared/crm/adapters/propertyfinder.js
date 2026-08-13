// Property Finder leads adapter.
//
// Confirmed against the real Atlas API (manual probe, 2026-08-12):
//   - POST /v1/auth/token (apiKey/apiSecret -> accessToken) is the same
//     auth flow api/sync-pf-listings.js already uses for listings.
//   - GET /v1/leads?page=&perPage= returns real lead data:
//     { data: [...], pagination: { page, perPage, total, totalPages } }.
//     Each lead has channel, createdAt, id (e.g. "message_lead_31184928"
//     - the stable PF lead id), listing: { id, reference } (absent for
//     leads not tied to a listing), sender: { name, contacts: [{type,
//     value}] }, status (PF's own inbox status: sent/read/replied - a
//     SOURCE status, never written to leads.status), tags, responseLink.
//   - PF's Listings API does NOT return a public URL/slug for a listing.
//     Do not attempt to construct one from the PF listing id.
//   - GET /v1/listings?filter[reference]=<ref> resolves a lead's listing
//     reference to exactly one PF listing, whose
//     compliance.listingAdvertisementNumber is the same RERA/DLD permit
//     api/sync-pf-listings.js already stores as secondary_listings.dld_permit
//     - that shared key is how a PF lead maps to a FORE property page.
//
// Known gap (not handled here - a caller decision, not an adapter one):
// leads.email is NOT NULL (scripts/create-leads-platform-tables.sql) and
// was never relaxed by migration-crm-leads-extension.sql, but PF leads
// are frequently phone-only (no email in sender.contacts at all) - see
// normalize() below, which leaves email null in that case. Inserting a
// phone-only PF lead as-is will violate that constraint until either the
// schema is relaxed or a policy for the missing-email case is decided.

const PF_API_BASE = 'https://atlas.propertyfinder.com';
const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

const API_KEY = process.env.PF_API_KEY;
const API_SECRET = process.env.PF_API_SECRET;

async function getPfToken() {
  if (!API_KEY || !API_SECRET) throw new Error('PF_API_KEY or PF_API_SECRET not configured');

  const res = await fetch(`${PF_API_BASE}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey: API_KEY, apiSecret: API_SECRET }),
  });
  if (!res.ok) throw new Error(`PF auth failed (${res.status})`);

  const data = await res.json();
  return data.accessToken;
}

async function fetchLeadsPage(token, page, perPage) {
  const res = await fetch(`${PF_API_BASE}/v1/leads?page=${page}&perPage=${perPage}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`PF leads fetch failed (${res.status})`);
  return res.json();
}

// Resolves a PF lead's listing reference to a FORE property, via PF's
// Listings API + the RERA/DLD permit shared with secondary_listings.
// Never throws - an unresolved property must not block importing the
// lead itself (see Step 3 of the CRM leads-import plan: property_id/
// property_url just stay null). Returns { propertyId, propertyUrl }.
async function resolveProperty(token, reference, serviceKey) {
  if (!reference) return { propertyId: null, propertyUrl: null, propertyTitle: null };

  try {
    const listingRes = await fetch(
      `${PF_API_BASE}/v1/listings?filter[reference]=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!listingRes.ok) return { propertyId: null, propertyUrl: null, propertyTitle: null };

    const listingJson = await listingRes.json();
    const results = listingJson.results || [];
    if (results.length !== 1) return { propertyId: null, propertyUrl: null, propertyTitle: null };

    const permit = (results[0].compliance || {}).listingAdvertisementNumber;
    if (!permit) return { propertyId: null, propertyUrl: null, propertyTitle: null };

    // `name` is the same canonical title column api/sync-pf-listings.js
    // already writes from PF's own listing title, and the same field
    // properties.html/property-detail.html render elsewhere on the site.
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/secondary_listings?select=id,name&dld_permit=eq.${encodeURIComponent(permit)}&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!matchRes.ok) return { propertyId: null, propertyUrl: null, propertyTitle: null };

    const matches = await matchRes.json();
    if (matches.length !== 1) return { propertyId: null, propertyUrl: null, propertyTitle: null };

    const id = matches[0].id;
    return {
      propertyId: id,
      propertyUrl: `property-detail.html?id=${id}&type=secondary`,
      propertyTitle: matches[0].name || null,
    };
  } catch (err) {
    console.error('[crm/propertyfinder] resolveProperty failed', { reference, error: String((err && err.message) || err) });
    return { propertyId: null, propertyUrl: null, propertyTitle: null };
  }
}

function extractContact(raw, type) {
  const contacts = (raw.sender && raw.sender.contacts) || [];
  const match = contacts.find((c) => c.type === type);
  return match ? match.value : null;
}

// Normalizes one raw PF lead (GET /v1/leads item) + its resolved property
// into leads-table row shape. PF's own status (sent/read/replied) is a
// SOURCE status and is preserved under details.propertyfinder.status -
// it is never written to leads.status, which always starts at 'new' for
// a freshly-imported lead (the table default - not set explicitly here).
function normalize(raw, property) {
  const reference = (raw.listing && raw.listing.reference) || null;

  return {
    source: 'propertyfinder',
    source_lead_id: String(raw.id || ''),
    full_name: (raw.sender && raw.sender.name) || '',
    email: extractContact(raw, 'email'),
    phone: extractContact(raw, 'phone'),
    message: raw.message || null,
    lead_type: raw.channel || 'unknown',
    property_id: (property && property.propertyId) || null,
    property_url: (property && property.propertyUrl) || null,
    property_title: (property && property.propertyTitle) || null,
    details: {
      propertyfinder: {
        channel: raw.channel,
        status: raw.status,
        listingReference: reference,
        listingId: (raw.listing && raw.listing.id) || null,
        entityType: raw.entityType || null,
        tags: raw.tags || null,
        responseLink: raw.responseLink || null,
      },
    },
    created_at: raw.createdAt || null,
  };
}

async function fetchNewLeads({ page = 1, perPage = 25, serviceKey = process.env.SERVICE_KEY } = {}) {
  if (!API_KEY || !API_SECRET) {
    console.warn('[crm/propertyfinder] not configured — PF_API_KEY / PF_API_SECRET missing. Skipping.');
    return { leads: [], pagination: {} };
  }
  if (!serviceKey) throw new Error('SERVICE_KEY not configured');

  const token = await getPfToken();
  const json = await fetchLeadsPage(token, page, perPage);
  const rawLeads = json.data || [];

  const leads = [];
  for (const raw of rawLeads) {
    const reference = (raw.listing && raw.listing.reference) || null;
    const property = await resolveProperty(token, reference, serviceKey);
    leads.push(normalize(raw, property));
  }

  return { leads, pagination: json.pagination || {} };
}

module.exports = { getPfToken, fetchLeadsPage, resolveProperty, normalize, fetchNewLeads };
