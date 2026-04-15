// ═══════════════════════════════════════════════════════════════
// Property Finder → Supabase Sync (Vercel Serverless Function)
// Fetches all listings from PF Enterprise API, upserts into
// secondary_listings using dld_permit as the unique key.
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';
const PF_AUTH_URL = 'https://auth.propertyfinder.com/auth/oauth/v1/token';
const PF_API_BASE = 'https://rest.apiv2.propertyfinder.ae'; // adjust if different

// ── Get PF access token via OAuth2 client credentials ──
async function getPfToken() {
  const key = process.env.PF_API_KEY;
  const secret = process.env.PF_API_SECRET;
  if (!key || !secret) throw new Error('PF_API_KEY or PF_API_SECRET not configured');

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const res = await fetch(PF_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scope: 'listings:full_access',
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PF auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ── Fetch all listings from PF with pagination ──
async function fetchAllPfListings(token) {
  let allListings = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${PF_API_BASE}/v1/listings?page=${page}&per_page=${perPage}`;
    console.log(`[PF-SYNC] Fetching page ${page}...`);

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`PF listings fetch failed (${res.status}): ${err}`);
    }

    const json = await res.json();

    // PF API may return { data: [...], meta: { current_page, last_page } }
    // or { listings: [...] } — handle both shapes
    const listings = json.data || json.listings || json.results || [];
    if (listings.length === 0) break;

    allListings = allListings.concat(listings);

    // Check pagination — stop if we've reached the last page
    const meta = json.meta || json.pagination || {};
    const lastPage = meta.last_page || meta.total_pages || meta.pages;
    if (lastPage && page >= lastPage) break;

    // Safety: if no pagination info, stop after first page
    if (!lastPage && listings.length < perPage) break;

    page++;
  }

  return allListings;
}

// ── Map a PF listing to our secondary_listings schema ──
function mapToRow(pf) {
  // PF response structure (common field names — adjust if your response differs)
  // The mapping handles nested and flat structures
  const location = pf.location || pf.community || {};
  const agent = pf.agent || pf.broker || {};
  const photos = pf.photos || pf.images || pf.media || [];
  const amenities = pf.amenities || pf.features || [];

  // Extract photo URLs — handle both string arrays and object arrays
  const photoUrls = photos.map(p => (typeof p === 'string' ? p : (p.url || p.full || p.main || ''))).filter(Boolean);

  // Build agent display name
  const agentName = agent.name || [agent.first_name, agent.last_name].filter(Boolean).join(' ') || '';

  return {
    // Core fields
    name: pf.title || pf.title_en || pf.name || '',
    price: Number(pf.price) || 0,
    bedrooms: pf.bedrooms != null ? String(pf.bedrooms) : null,
    bathrooms: Number(pf.bathrooms) || null,
    area_sqft: Number(pf.size || pf.area || pf.size_sqft || pf.area_sqft) || null,
    floor: pf.floor != null ? String(pf.floor) : null,

    // Location
    location: typeof location === 'string' ? location : (location.name || location.community || location.area || pf.community_name || ''),
    city: (typeof location === 'object' ? location.city : null) || pf.city || 'Dubai',

    // Status & details
    status: pf.completion_status === 'completed' ? 'Vacant' : (pf.furnishing === 'furnished' ? 'Rented' : 'Vacant'),
    furnished: mapFurnishing(pf.furnishing || pf.furnished),
    view: pf.view || '',
    parking: pf.parking != null ? Number(pf.parking) > 0 : false,
    service_charge: Number(pf.service_charge) || null,

    // Description & features
    description: pf.description || pf.description_en || '',
    features: Array.isArray(amenities) ? amenities.map(a => (typeof a === 'string' ? a : (a.name || a.text || ''))).filter(Boolean).join(', ') : (typeof amenities === 'string' ? amenities : ''),

    // Images
    image_main: photoUrls[0] || null,
    images: photoUrls.join(', ') || null,
    floor_plan: pf.floor_plan_url || pf.floor_plan || null,

    // Permit & reference — THIS IS THE UNIQUE KEY
    dld_permit: pf.permit_number || pf.rera_permit || pf.reference || pf.permit || pf.dld_permit_number || '',

    // Agent
    agent: agentName,

    // Listing metadata
    listing_type: 'ready_secondary',
    property_type: mapPropertyType(pf.property_type || pf.type || pf.category),
    building_name: pf.building || pf.tower_name || pf.project_name || '',
    reference_number: pf.reference || pf.reference_number || '',
    ownership: pf.ownership || 'Freehold',
    published: true,
    featured: false,
  };
}

function mapFurnishing(val) {
  if (!val) return 'Unfurnished';
  const v = String(val).toLowerCase();
  if (v === 'furnished' || v === 'yes') return 'Furnished';
  if (v.includes('semi') || v === 'partly') return 'Semi-Furnished';
  return 'Unfurnished';
}

function mapPropertyType(val) {
  if (!val) return 'Apartment';
  const v = String(val).toLowerCase();
  if (v.includes('villa')) return 'Villa';
  if (v.includes('town')) return 'Townhouse';
  if (v.includes('pent')) return 'Penthouse';
  if (v.includes('duplex')) return 'Duplex';
  if (v.includes('studio')) return 'Studio';
  if (v.includes('loft')) return 'Loft';
  if (v.includes('office')) return 'Office';
  if (v.includes('retail') || v.includes('shop')) return 'Retail';
  if (v.includes('warehouse')) return 'Warehouse';
  if (v.includes('land')) return 'Land';
  return 'Apartment';
}

// ── Upsert rows into Supabase (using dld_permit as conflict key) ──
async function supabaseUpsert(rows, serviceKey) {
  // Use the Supabase REST API with on-conflict resolution on dld_permit
  const res = await fetch(`${SUPABASE_URL}/rest/v1/secondary_listings?on_conflict=dld_permit`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${err}`);
  }

  const result = await res.json();
  return result.length || rows.length;
}

// ── Handler ──
module.exports = async function handler(req, res) {
  // Allow: Vercel cron header, CRON_SECRET bearer, or admin password bearer
  const cronHeader = req.headers['x-vercel-cron'];
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const isAuthed = cronHeader || token === process.env.CRON_SECRET || token === 'FORE2024';

  if (!isAuthed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const serviceKey = process.env.SERVICE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SERVICE_KEY not configured' });
  }

  try {
    // Step 1: Get PF access token
    console.log('[PF-SYNC] Authenticating with Property Finder...');
    const token = await getPfToken();
    console.log('[PF-SYNC] Authenticated successfully');

    // Step 2: Fetch all listings
    const pfListings = await fetchAllPfListings(token);
    console.log(`[PF-SYNC] Fetched ${pfListings.length} listings from Property Finder`);

    if (pfListings.length === 0) {
      return res.status(200).json({ success: true, count: 0, message: 'No listings found on Property Finder' });
    }

    // Step 3: Map to our schema
    const rows = pfListings.map(mapToRow).filter(r => r.dld_permit); // skip rows without a permit number
    console.log(`[PF-SYNC] Mapped ${rows.length} listings (skipped ${pfListings.length - rows.length} without DLD permit)`);

    // Step 4: Upsert in batches of 50
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const count = await supabaseUpsert(batch, serviceKey);
      upserted += count;
    }

    console.log(`[PF-SYNC] Done. Upserted ${upserted} listings.`);
    return res.status(200).json({
      success: true,
      count: upserted,
      total_fetched: pfListings.length,
      skipped_no_permit: pfListings.length - rows.length,
    });
  } catch (err) {
    console.error('[PF-SYNC] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
