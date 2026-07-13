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
    const url = `${PF_API_BASE}/v1/listings?page=${page}&perPage=${perPage}&sort[createdAt]=desc`;
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

// ── Resolve location IDs to names via PF Locations API ──
async function resolveLocationNames(listings, token) {
  // Collect unique location IDs
  const locationIds = [...new Set(
    listings
      .map(l => l.location && l.location.id)
      .filter(Boolean)
  )];

  if (locationIds.length === 0) return {};

  const locationMap = {};

  // Fetch each location by ID (PF locations endpoint requires search, but supports filter[id])
  for (const id of locationIds) {
    try {
      const res = await fetch(`${PF_API_BASE}/v1/locations?filter[id]=${id}&perPage=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Accept-Language': 'en',
        },
      });
      if (res.ok) {
        const json = await res.json();
        const loc = (json.data || [])[0];
        if (loc) {
          // Build full location path from tree: e.g. "Dubai Marina, Dubai"
          const tree = loc.tree || [];
          const parts = tree.map(t => t.name).filter(Boolean);
          const name = loc.name || '';
          locationMap[id] = {
            name: name,
            fullPath: parts.length > 0 ? parts.join(', ') : name,
            city: (tree.find(t => t.type === 'CITY') || {}).name || '',
          };
        }
      }
    } catch (e) {
      console.error(`[PF-SYNC] Failed to resolve location ${id}:`, e.message);
    }
  }

  return locationMap;
}

// ── Deduplicate PF listings that share the same real DLD/RERA permit ──
// (compliance.listingAdvertisementNumber). This is a genuine Property
// Finder data-quality issue (e.g. the same unit relisted under two ad
// IDs) — see the PF sync ON CONFLICT investigation. Two listings with
// the same permit both map to the same dld_permit, which violates the
// partial unique index idx_secondary_listings_dld_permit and makes a
// single upsert batch fail with "ON CONFLICT DO UPDATE command cannot
// affect row a second time". Listings with no compliance permit at all
// are left untouched here — they're unaffected by this collision and
// still fall back to pf.reference in mapToRow() as before.
//
// Selection rule (deterministic, independent of fetch/pagination order):
// keep the listing with the most recent createdAt; if two listings have
// the exact same createdAt, break the tie by the greater PF listing id
// (plain string comparison) so the outcome is always the same regardless
// of how the API happened to order the page.
function dedupeByCompliancePermit(pfListings) {
  const groups = new Map();
  for (const pf of pfListings) {
    const permit = (pf.compliance || {}).listingAdvertisementNumber;
    if (!permit) continue;
    if (!groups.has(permit)) groups.set(permit, []);
    groups.get(permit).push(pf);
  }

  const discardedIds = new Set();
  const discarded = [];

  for (const [permit, group] of groups) {
    if (group.length < 2) continue;

    const winner = group.slice().sort((a, b) => {
      const byDate = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (byDate !== 0) return byDate;
      return String(b.id).localeCompare(String(a.id));
    })[0];

    for (const pf of group) {
      if (pf.id === winner.id) continue;
      discardedIds.add(pf.id);
      discarded.push({
        permit,
        discardedId: pf.id,
        discardedReference: pf.reference || '',
        keptId: winner.id,
        keptReference: winner.reference || '',
      });
    }
  }

  const deduped = discardedIds.size === 0 ? pfListings : pfListings.filter(pf => !discardedIds.has(pf.id));

  return { deduped, duplicatesRemoved: discarded.length, discarded };
}

// ── Map a PF listing to our secondary_listings schema ──
// Based on PF "response-combined-flat" schema from OpenAPI spec
function mapToRow(pf, locationMap) {
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

  // Amenities: map PF slugs to our display labels (matches admin checkbox values)
  const amenityMap = {
    'central-ac': 'Central A/C',
    'built-in-wardrobes': 'Built-in Wardrobes',
    'kitchen-appliances': 'Kitchen Appliances',
    'security': 'Security',
    'concierge': 'Concierge',
    'maid-service': 'Maid Service',
    'balcony': 'Balcony',
    'private-gym': 'Private Gym',
    'shared-gym': 'Shared Gym',
    'private-jacuzzi': 'Private Jacuzzi',
    'shared-spa': 'Shared Spa',
    'covered-parking': 'Covered Parking',
    'maids-room': "Maid's Room",
    'study': 'Study',
    'childrens-play-area': "Children's Play Area",
    'pets-allowed': 'Pets Allowed',
    'barbecue-area': 'Barbecue Area',
    'shared-pool': 'Shared Pool',
    'childrens-pool': "Children's Pool",
    'private-garden': 'Private Garden',
    'private-pool': 'Private Pool',
    'view-of-water': 'View of Water',
    'view-of-landmark': 'View of Landmark',
    'walk-in-closet': 'Walk-in Closet',
    'lobby-in-building': 'Lobby in Building',
    'networked': 'Networked',
    'dining-in-building': 'Dining in Building',
    'conference-room': 'Conference Room',
  };
  const amenities = pf.amenities || [];
  const featuresStr = amenities
    .map(a => amenityMap[a] || a.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(', ');

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

  const row = {
    name: title,
    price: Number(price) || 0,
    bedrooms: pf.bedrooms != null ? String(pf.bedrooms) : null,
    bathrooms: pf.bathrooms != null ? Number(pf.bathrooms) : null,
    area_sqft: Number(pf.size) || null,
    floor: pf.floorNumber || null,

    // Location — resolved from PF Locations API
    location: (locationMap || {})[pf.location && pf.location.id]
      ? locationMap[pf.location.id].name
      : '',
    city: (locationMap || {})[pf.location && pf.location.id]
      ? (locationMap[pf.location.id].city || (pf.uaeEmirate === 'abu_dhabi' ? 'Abu Dhabi' : 'Dubai'))
      : (pf.uaeEmirate === 'abu_dhabi' ? 'Abu Dhabi' : 'Dubai'),

    status: 'Vacant',
    offering_type: priceObj.type === 'sale' ? 'sale' : (priceObj.type ? 'rent' : 'sale'),
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

    listing_type: listingType,
    property_type: mapPropertyType(pf.type),
    building_name: pf.developer || '',
    reference_number: pf.reference || '',
    ownership: 'Freehold',
    published: true,
    featured: false,
    created_at: pf.createdAt || new Date().toISOString(),
  };

  // Note: agent is intentionally NOT synced from PF — manually assigned in admin panel

  return row;
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
    'hotel-apartment': 'Hotel Apartment',
    'bungalow': 'Bungalow',
    'compound': 'Compound',
    'full-floor': 'Full Floor',
    'half-floor': 'Half Floor',
    'whole-building': 'Whole Building',
    'office-space': 'Office',
    'retail': 'Retail',
    'shop': 'Shop',
    'show-room': 'Showroom',
    'warehouse': 'Warehouse',
    'factory': 'Factory',
    'co-working-space': 'Co-Working Space',
    'business-center': 'Business Center',
    'staff-accommodation': 'Staff Accommodation',
    'labor-camp': 'Labor Camp',
    'land': 'Land',
    'farm': 'Farm',
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

    // Step 2b: Deduplicate listings that share the same real DLD/RERA permit
    // before anything downstream touches them — see dedupeByCompliancePermit().
    const { deduped: dedupedListings, duplicatesRemoved, discarded } = dedupeByCompliancePermit(pfListings);
    for (const d of discarded) {
      console.log(
        `[PF-SYNC] Duplicate permit ${d.permit}: discarding PF listing ${d.discardedId} (ref: ${d.discardedReference || 'n/a'}) — keeping ${d.keptId} (ref: ${d.keptReference || 'n/a'})`
      );
    }
    if (duplicatesRemoved > 0) {
      console.log(`[PF-SYNC] Removed ${duplicatesRemoved} duplicate listing(s) sharing a permit with another listing.`);
    }

    // Step 2c: Resolve location IDs to names
    let locationMap = {};
    try {
      locationMap = await resolveLocationNames(dedupedListings, pfToken);
    } catch (e) {
      console.error('[PF-SYNC] Location resolution failed, continuing without:', e.message);
    }

    // Step 3: Map and filter
    const rows = dedupedListings.map(pf => mapToRow(pf, locationMap)).filter(r => r.dld_permit);
    const skipped = dedupedListings.length - rows.length;

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
      duplicates_removed: duplicatesRemoved,
      skipped_no_permit: skipped,
    });
  } catch (err) {
    console.error('[PF-SYNC] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
