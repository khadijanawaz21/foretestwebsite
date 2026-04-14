const BEHOMES_BASE = 'https://api.behomes.tech/v3/get_behomes_objects';
const API_KEY = 'EAJF8XND';
const PER_PAGE = 200;
const HANDOVER_CUTOFF = new Date('2026-01-01').getTime();
const WHITELISTED_DEVS = ['emaar', 'damac', 'nakheel', 'sobha', 'binghatti', 'samana', 'danube'];
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

let cache = { data: null, ts: 0 };

function isWhitelisted(p) {
  const org = ((p.Organisation || {}).organizationName || '').toLowerCase();
  return WHITELISTED_DEVS.some(d => org.includes(d));
}

// Strip heavy fields the frontend doesn't need
function slim(p) {
  return {
    project_id: p.project_id,
    ShortName: p.ShortName,
    OffplanOrSecondary: p.OffplanOrSecondary,
    LayoutPriceMin: p.LayoutPriceMin,
    LayoutPriceMax: p.LayoutPriceMax,
    LayoutAreaTotalMin: p.LayoutAreaTotalMin,
    LayoutAreaTotalMax: p.LayoutAreaTotalMax,
    DeliveryDate: p.DeliveryDate,
    CreatedDate: p.CreatedDate,
    Avatar: p.Avatar,
    Type: p.Type ? { name: p.Type.name } : null,
    Location: p.Location ? {
      address: p.Location.address,
      district: p.Location.district,
      city: p.Location.city ? { name: p.Location.city.name } : null,
      lat: p.Location.lat,
      lng: p.Location.lng,
    } : null,
    Organisation: p.Organisation ? {
      organizationName: p.Organisation.organizationName,
      organizationLogo: p.Organisation.organizationLogo,
    } : null,
    Currency: p.Currency ? {
      currencySymbol: p.Currency.currencySymbol,
      currencyValueUSD: p.Currency.currencyValueUSD,
    } : null,
    Bedrooms: p.Bedrooms || p.BedroomsMin || null,
    Recomended: p.Recomended,
  };
}

async function fetchAllListings() {
  const url = `${BEHOMES_BASE}?lang=en&api_key=${API_KEY}&filter=yes&objects_per_page=${PER_PAGE}&page=1`;
  const res1 = await fetch(url);
  const json1 = await res1.json();
  let items = json1.response || [];
  const maxPages = (json1.filter_params && json1.filter_params.max_pages) || 1;

  if (maxPages > 1) {
    const fetches = [];
    for (let p = 2; p <= maxPages; p++) {
      fetches.push(
        fetch(`${BEHOMES_BASE}?lang=en&api_key=${API_KEY}&filter=yes&objects_per_page=${PER_PAGE}&page=${p}`)
          .then(r => r.json())
          .then(j => j.response || [])
          .catch(() => [])
      );
    }
    const pages = await Promise.all(fetches);
    pages.forEach(batch => { items = items.concat(batch); });
  }

  // Filter: whitelisted devs + handover after cutoff
  items = items.filter(p => isWhitelisted(p) && (!p.DeliveryDate || p.DeliveryDate >= HANDOVER_CUTOFF));

  // Sort newest first
  items.sort((a, b) => (b.CreatedDate || 0) - (a.CreatedDate || 0));

  // Slim down each item
  return items.map(slim);
}

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (cache.data && (now - cache.ts) < CACHE_TTL) {
      res.setHeader('X-Cache', 'HIT');
    } else {
      cache.data = await fetchAllListings();
      cache.ts = now;
      res.setHeader('X-Cache', 'MISS');
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ count: cache.data.length, listings: cache.data });
  } catch (err) {
    console.error('Listings API error:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
}
