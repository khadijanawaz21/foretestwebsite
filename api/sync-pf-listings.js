// ═══════════════════════════════════════════════════════════════
// Property Finder → Supabase Sync (Vercel Serverless Function)
// Based on PF Enterprise API OpenAPI spec v1.0.1
// Upserts into secondary_listings using dld_permit as unique key.
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';
const PF_API_BASE = 'https://atlas.propertyfinder.com';

// ── Get PF access token ──
async function getPfToken() {
  const key = process.env.PF_API_KEY;
  const secret = process.env.PF_API_SECRET;
  if (!key || !secret) throw new Error('PF_API_KEY or PF_API_SECRET not configured');

  const res = await fetch(`${PF_API_BASE}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ apiKey: key, apiSecret: secret }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PF auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  // Response: { accessToken, expiresIn, tokenType }
  return data.accessToken;
}

// ── Fetch all listings from PF with pagination ──
async function fetchAllPfListings(token) {
  let allListings = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    // PF API uses "perPage" not "per_page"
    const url = `${PF_API_BASE}/v1/listings?page=${page}&perPage=${perPage}`;
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

    // PF response: { results: [...], pagination: { page, perPage, total, totalPages, nextPage, prevPage } }
    const listings = json.results || [];
    if (listings.length === 0) break;

    allListings = allListings.concat(listings);

    const pagination = json.pagination || {};
    if (!pagination.nextPage || page >= (pagination.totalPages || page)) break;

    page++;
  }

  return allListings;
}

// ── Map a PF listing to our secondary_listings schema ──
// Based on PF "response-combined-flat" schema from OpenAPI spec
function mapToRow(pf) {
  // Title: { en, ar } object
  const title = (pf.title && pf.title.en) || '';

  // Description: { en, ar } object
  const description = (pf.description && pf.description.en) || '';

  // Price: { type, amounts: { sale, yearly, monthly, daily, weekly } }
  const priceObj = pf.price || {};
  const amounts = priceObj.amounts || {};
  const price = amounts.sale || amounts.yearly || amounts.monthly || amounts.daily || 0;

  // Images: { images: [{ original: { url }, large: { url }, ... }], videos: {} }
  const media = pf.media || {};
  const images = media.images || [];
  const photoUrls = images
    .map(img => {
      if (img.original && img.original.url) return img.original.url;
      if (img.large && img.large.url) return img.large.url;
      return '';
    })
    .filter(Boolean);

  // Amenities: string array like ["central-ac", "shared-pool", ...]
  const amenities = pf.amenities || [];
  const featuresStr = amenities
    .map(a => a.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(', ');

  // Agent: assignedTo { id, name, photos }
  const assignedTo = pf.assignedTo || {};
  const agentName = assignedTo.name || '';

  // DLD permit: compliance.listingAdvertisementNumber (RERA permit number)
  const compliance = pf.compliance || {};
  const dldPermit = compliance.listingAdvertisementNumber || pf.reference || '';

  // Determine listing_type based on projectStatus and category
  let listingType = 'ready_secondary';
  if (pf.projectStatus === 'off_plan' || pf.projectStatus === 'off_plan_primary') {
    listingType = 'secondary_offplan';
  }
  if (pf.category === 'commercial') {
    listingType = 'commercial';
  }

  return {
    name: title,
    price: Number(price) || 0,
    bedrooms: pf.bedrooms != null ? String(pf.bedrooms) : null,
    bathrooms: pf.bathrooms != null ? Number(pf.bathrooms) : null,
    area_sqft: Number(pf.size) || null,
    floor: pf.floorNumber || null,

    // Location — PF only returns location.id, not a name
    // We'll use the reference or leave blank; you can enrich later
    location: '',
    city: pf.uaeEmirate === 'abu_dhabi' ? 'Abu Dhabi' : 'Dubai',

    status: 'Vacant',
    furnished: mapFurnishing(pf.furnishingType),
    view: '',
    parking: pf.hasParkingOnSite || false,
    service_charge: null,

    description: description,
    features: featuresStr,

    image_main: photoUrls[0] || null,
    images: photoUrls.join(', ') || null,
    floor_plan: null,

    // Unique key for upsert
    dld_permit: dldPermit,
    rera_permit: compliance.listingAdvertisementNumber || '',

    agent: agentName,

    listing_type: listingType,
    property_type: mapPropertyType(pf.type),
    building_name: pf.developer || '',
    reference_number: pf.reference || '',
    ownership: 'Freehold',
    published: true,
    featured: false,
  };
}

function mapFurnishing(val) {
  if (!val) return 'Unfurnished';
  if (val === 'furnished') return 'Furnished';
  if (val === 'semi-furnished') return 'Semi-Furnished';
  return 'Unfurnished';
}

function mapPropertyType(val) {
  if (!val) return 'Apartment';
  const map = {
    'apartment': 'Apartment',
    'villa': 'Villa',
    'townhouse': 'Townhouse',
    'penthouse': 'Penthouse',
    'duplex': 'Duplex',
    'hotel-apartment': 'Apartment',
    'office-space': 'Office',
    'retail': 'Retail',
    'shop': 'Retail',
    'show-room': 'Retail',
    'warehouse': 'Warehouse',
    'land': 'Land',
    'farm': 'Land',
    'full-floor': 'Apartment',
    'half-floor': 'Apartment',
    'whole-building': 'Apartment',
    'compound': 'Villa',
    'bungalow': 'Villa',
    'co-working-space': 'Office',
    'business-center': 'Office',
  };
  return map[val] || 'Apartment';
}

// ── Upsert rows into Supabase (using dld_permit as conflict key) ──
async function supabaseUpsert(rows, serviceKey) {
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
  const url = new URL(req.url, `https://${req.headers.host}`);
  const adminKey = url.searchParams.get('admin_key');
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cronHeader = req.headers['x-vercel-cron'];

  const isAuthed = cronHeader
    || bearerToken === 'FORE2024'
    || adminKey === 'FORE2024'
    || (process.env.CRON_SECRET && (bearerToken === process.env.CRON_SECRET || adminKey === process.env.CRON_SECRET));

  if (!isAuthed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const serviceKey = process.env.SERVICE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SERVICE_KEY not configured' });
  }

  try {
    // Step 1: Authenticate
    let pfToken;
    try {
      pfToken = await getPfToken();
    } catch (authErr) {
      return res.status(500).json({ error: 'PF Auth failed: ' + authErr.message, step: 'auth' });
    }

    // Step 2: Fetch all listings
    let pfListings;
    try {
      pfListings = await fetchAllPfListings(pfToken);
    } catch (fetchErr) {
      return res.status(500).json({ error: 'PF Fetch failed: ' + fetchErr.message, step: 'fetch_listings' });
    }

    if (pfListings.length === 0) {
      return res.status(200).json({ success: true, count: 0, message: 'No listings found on Property Finder' });
    }

    // Step 3: Map and filter
    const rows = pfListings.map(mapToRow).filter(r => r.dld_permit);
    const skipped = pfListings.length - rows.length;

    // Step 4: Upsert in batches
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const count = await supabaseUpsert(batch, serviceKey);
      upserted += count;
    }

    return res.status(200).json({
      success: true,
      count: upserted,
      total_fetched: pfListings.length,
      skipped_no_permit: skipped,
    });
  } catch (err) {
    console.error('[PF-SYNC] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
