const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbWtuZWtkYnRybXhvcHl3Z3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjMxOTksImV4cCI6MjA4OTAzOTE5OX0.HCmQ_4cyuImr3S1wQ-V6oW2G2U4a1rzMUlLPqHC-OeA';

// Map Supabase rows back to the shape the frontend expects
function toFrontend(row) {
  return {
    project_id: row.project_id,
    ShortName: row.short_name,
    OffplanOrSecondary: row.offplan_or_secondary,
    LayoutPriceMin: row.price_min,
    LayoutPriceMax: row.price_max,
    LayoutAreaTotalMin: row.area_min,
    LayoutAreaTotalMax: row.area_max,
    DeliveryDate: row.delivery_date,
    CreatedDate: row.created_date,
    Avatar: row.avatar,
    Type: row.type_name ? { name: row.type_name } : null,
    Location: {
      address: row.location_address,
      district: row.location_district,
      city: row.location_city ? { name: row.location_city } : null,
      lat: row.location_lat,
      lng: row.location_lng,
    },
    Organisation: {
      organizationName: row.org_name,
      organizationLogo: row.org_logo,
    },
    Currency: {
      currencySymbol: row.currency_symbol,
      currencyValueUSD: row.currency_usd,
    },
    Bedrooms: row.bedrooms,
    Recomended: row.recommended,
  };
}

module.exports = async function handler(req, res) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/offplan_listings?order=created_date.desc&limit=1000`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`);
    }

    const rows = await response.json();
    const listings = rows.map(toFrontend);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ count: listings.length, listings });
  } catch (err) {
    console.error('Listings API error:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
}
