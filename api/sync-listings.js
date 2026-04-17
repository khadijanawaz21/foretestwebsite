const BEHOMES_BASE = 'https://api.behomes.tech/v3/get_behomes_objects';
const API_KEY = 'EAJF8XND';
const PER_PAGE = 100; // 200 causes timeouts on some pages
const HANDOVER_CUTOFF = new Date('2026-01-01').getTime();
const WHITELISTED_DEVS = ['emaar', 'damac', 'nakheel', 'sobha', 'binghatti', 'samana', 'danube'];

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

function isWhitelisted(p) {
  const org = ((p.Organisation || {}).organizationName || '').toLowerCase();
  return WHITELISTED_DEVS.some(d => org.includes(d));
}

function toRow(p) {
  return {
    project_id: p.project_id,
    short_name: p.ShortName || '',
    offplan_or_secondary: p.OffplanOrSecondary || 'Off-plan',
    price_min: p.LayoutPriceMin || null,
    price_max: p.LayoutPriceMax || null,
    area_min: p.LayoutAreaTotalMin || null,
    area_max: p.LayoutAreaTotalMax || null,
    delivery_date: p.DeliveryDate || null,
    created_date: p.CreatedDate || null,
    avatar: p.Avatar || null,
    type_name: (p.Type && p.Type.name) || null,
    location_address: (p.Location && p.Location.address) || null,
    location_district: (p.Location && p.Location.district) || null,
    location_city: (p.Location && p.Location.city && p.Location.city.name) || null,
    location_lat: (p.Location && p.Location.lat) || null,
    location_lng: (p.Location && p.Location.lng) || null,
    org_name: (p.Organisation && p.Organisation.organizationName) || null,
    org_logo: (p.Organisation && p.Organisation.organizationLogo) || null,
    currency_symbol: (p.Currency && p.Currency.currencySymbol) || 'AED',
    currency_usd: (p.Currency && p.Currency.currencyValueUSD) || null,
    bedrooms: p.Bedrooms || p.BedroomsMin || null,
    recommended: p.Recomended || false,
    synced_at: new Date().toISOString(),
  };
}

async function fetchAllFromBehomes() {
  const url = `${BEHOMES_BASE}?lang=en&api_key=${API_KEY}&filter=yes&objects_per_page=${PER_PAGE}&page=1`;
  const res1 = await fetch(url);
  const json1 = await res1.json();
  let items = json1.response || [];
  const maxPages = (json1.filter_params && json1.filter_params.max_pages) || 1;

  if (maxPages > 1) {
    // Fetch remaining pages sequentially to avoid overloading the API
    for (let p = 2; p <= maxPages; p++) {
      try {
        const r = await fetch(`${BEHOMES_BASE}?lang=en&api_key=${API_KEY}&filter=yes&objects_per_page=${PER_PAGE}&page=${p}`);
        const text = await r.text();
        try {
          const j = JSON.parse(text);
          items = items.concat(j.response || []);
        } catch (e) {
          console.error(`[SYNC] Page ${p} returned invalid JSON, skipping`);
        }
      } catch (e) {
        console.error(`[SYNC] Page ${p} fetch failed, skipping`);
      }
    }
  }

  return items.filter(p =>
    isWhitelisted(p) && (!p.DeliveryDate || p.DeliveryDate >= HANDOVER_CUTOFF)
  );
}

async function supabaseUpsert(rows, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/offplan_listings`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upsert failed (${res.status}): ${err}`);
  }
}

async function supabaseDeleteStale(activeIds, serviceKey) {
  // Delete rows whose project_id is NOT in the active set
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/offplan_listings?project_id=not.in.(${activeIds.map(encodeURIComponent).join(',')})`,
    {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error('[SYNC] Cleanup error:', err);
  }
}

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronHeader = req.headers['x-vercel-cron'];
  if (!cronHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const serviceKey = process.env.SERVICE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SERVICE_KEY not configured' });
  }

  try {
    console.log('[SYNC] Fetching from BeHomes API...');
    const items = await fetchAllFromBehomes();
    console.log(`[SYNC] Got ${items.length} filtered listings`);

    const rows = items.map(toRow);

    // Upsert in batches of 50
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      await supabaseUpsert(batch, serviceKey);
      upserted += batch.length;
    }

    // Remove stale listings
    const activeIds = rows.map(r => r.project_id);
    if (activeIds.length > 0) {
      await supabaseDeleteStale(activeIds, serviceKey);
    }

    console.log(`[SYNC] Done. Upserted ${upserted} listings.`);
    res.status(200).json({ success: true, count: upserted });
  } catch (err) {
    console.error('[SYNC] Fatal error:', err);
    res.status(500).json({ error: err.message });
  }
}
