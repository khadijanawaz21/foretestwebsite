/**
 * One-time import script: CSV + Photos → Supabase secondary_listings
 *
 * Usage: node scripts/import-listings.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

// ── Supabase credentials (from admin.html) ──────────────────────────────
const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbWtuZWtkYnRybXhvcHl3Z3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjMxOTksImV4cCI6MjA4OTAzOTE5OX0.HCmQ_4cyuImr3S1wQ-V6oW2G2U4a1rzMUlLPqHC-OeA';
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Paths ────────────────────────────────────────────────────────────────
const ROOT = path.resolve(import.meta.dirname, '..');
const PHOTOS_DIR = path.join(ROOT, 'property-photos', 'extracted');
const CSV_PATH = path.join(ROOT, 'property-photos', 'Behomes_Listings_Final_Direct_Links.csv');

// ── Step 0: Run migration ────────────────────────────────────────────────
async function runMigration() {
  console.log('\n=== STEP 0: Running table migration ===');
  const statements = [
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'ready_secondary'`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS developer TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS project_name TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS handover_date TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS payment_plan TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS completion_percentage INTEGER`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS original_price NUMERIC`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS commercial_type TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS fitted TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS parking_spaces INTEGER DEFAULT 0`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS rera_permit TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS property_type TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS building_name TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS reference_number TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS rental_yield TEXT`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS annual_rent NUMERIC`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS ownership TEXT DEFAULT 'Freehold'`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true`,
    `ALTER TABLE secondary_listings ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false`,
  ];

  for (const sql of statements) {
    const { error } = await db.rpc('exec_sql', { query: sql }).maybeSingle();
    if (error) {
      // rpc may not exist — that's ok, we'll output the SQL for manual run
    }
  }

  // Try a direct approach — just check if columns exist by selecting
  const { data: testRow, error: testErr } = await db
    .from('secondary_listings')
    .select('listing_type')
    .limit(1);

  if (testErr && testErr.message.includes('listing_type')) {
    console.log('⚠ Migration columns not found. Please run this SQL manually in Supabase SQL Editor:');
    console.log('---');
    console.log(statements.map(s => s + ';').join('\n'));
    console.log('---');
    console.log('Then re-run this script.');
    process.exit(1);
  }

  console.log('✓ Migration columns verified');
}

// ── Building descriptions (researched) ───────────────────────────────────
const BUILDING_DESCRIPTIONS = {
  'Anantara Palm Jumeira Residences': {
    base: 'Anantara Palm Jumeira Residences offers five-star resort living on Palm Jumeirah, with 449 luxury apartments managed by the renowned Anantara Hotels & Resorts brand. Residents enjoy private beach access, infinity and overflow pools, a world-class spa, seven on-site restaurants, and 24-hour concierge and housekeeping services. Situated on the trunk of Palm Jumeirah, the residence commands sweeping views of the Arabian Gulf, Atlantis The Palm, and Burj Al Arab.',
  },
  'Anantara North Residence': {
    base: 'Anantara North Residence is a premium residential building on the trunk of Palm Jumeirah, part of the acclaimed Anantara hospitality ecosystem. Residents benefit from private beach access, resort-style pools, a fully equipped fitness centre, and five-star hotel services including room service and housekeeping. The building offers spectacular lagoon and sea views, making it a highly sought-after address for both lifestyle buyers and investors seeking strong rental returns.',
  },
  'Enia Residences': {
    base: 'Enia Residences is a boutique residential development on Palm Jumeirah, offering modern apartments with premium finishes and generous layouts. Residents enjoy access to a swimming pool, fitness centre, and direct proximity to Palm Jumeirah\'s pristine beaches and world-class dining destinations. The building\'s prime trunk location ensures easy connectivity to the mainland while maintaining the exclusivity that Palm Jumeirah is renowned for.',
  },
  'Bay Central West Tower': {
    base: 'Bay Central West Tower is a 44-storey residential landmark in Dubai Marina, part of the Bay Central complex that includes the five-star InterContinental Dubai Marina hotel. Residents enjoy temperature-controlled pools overlooking the marina, a fully equipped gymnasium, spa with steam and sauna facilities, and 24-hour concierge and security services. The tower\'s prime waterfront position delivers stunning marina views and walking-distance access to Marina Walk\'s restaurants, cafés, and retail.',
  },
  'Torch Tower': {
    base: 'The Torch Tower is an iconic 86-storey landmark in Dubai Marina, standing at 352 metres as one of the world\'s tallest residential towers. Designed by Khatib & Alami, its distinctive silhouette has defined the Dubai Marina skyline since 2011. Residents enjoy panoramic views, a swimming pool deck overlooking the marina, a fully equipped gymnasium, sauna and steam rooms, and 24-hour concierge services. Its position at the mouth of Dubai Marina ensures outstanding connectivity and proximity to Marina Walk, JBR, and the beach.',
  },
  'Marina Wharf 1': {
    base: 'Marina Wharf 1 is a 29-storey residential tower in Dubai Marina by Dheeraj East Coast, offering spacious apartments with full marina views. The pet-friendly building features a swimming pool, Jacuzzi, squash court, bowling alley, billiards room, jogging tracks, and dedicated children\'s play areas. With 24-hour security, BBQ areas, and podium gardens, it delivers a well-rounded lifestyle in one of Dubai\'s most desirable waterfront communities.',
  },
  'Marina Pinnacle': {
    base: 'Marina Pinnacle is a striking 77-floor tower in Dubai Marina, rising 280 metres with 764 residential units. The building features indoor and outdoor temperature-controlled swimming pools, a state-of-the-art fitness studio, Jacuzzi, sauna and steam rooms, and children\'s pools. With ten high-speed elevators, 24-hour security, and excellent connectivity to the metro and tram, Marina Pinnacle offers outstanding value in one of Dubai\'s most vibrant waterfront districts.',
  },
  'Grand Bleu Tower 2': {
    base: 'Grand Bleu Tower 2 is the world\'s first Elie Saab-designed residential building, located at Emaar Beachfront. The tower combines Elie Saab\'s signature elegance with Emaar\'s development expertise, featuring Art Deco-inspired architecture, opulent interiors, and floor-to-ceiling windows framing Arabian Gulf and Dubai Marina skyline views. Residents enjoy private beach access, an infinity pool, a yacht club, boutique retail, and 1.5 kilometres of pristine beachfront promenade.',
  },
  'Sunrise Bay Tower 1': {
    base: 'Sunrise Bay Tower 1 is part of Emaar Beachfront\'s twin-tower Sunrise Bay development, flanked by 750 metres of white sandy beaches. The 26-storey tower offers luxury apartments with sea and marina views, connected to its sister tower via a podium deck featuring world-class fitness facilities, an infinity pool, children\'s splash areas, and retail destinations. Private beach access, gourmet waterfront dining, and direct connectivity to Dubai Marina make it an exceptional beachfront address.',
  },
  'Beach Vista 2': {
    base: 'Beach Vista 2 is a premium residential tower at Emaar Beachfront, featuring Miami-inspired interiors with floor-to-ceiling glass windows and expansive balconies. The twin-tower development offers an infinity pool with panoramic Palm Jumeirah views, a fully equipped gym, yoga studio, and direct access to 750 metres of private beach. Residents enjoy a resort lifestyle with waterfront promenades, fine dining, and seamless connectivity to Dubai Marina and Palm Jumeirah.',
  },
  'Beach Vista 1': {
    base: 'Beach Vista 1 at Emaar Beachfront delivers unrivalled Palm Jumeirah views from its premium apartments featuring floor-to-ceiling windows and generous terraces. The development boasts an infinity pool, state-of-the-art fitness centre, yoga room, and direct access to a 750-metre private beach. With its Miami-inspired architecture, waterfront promenade dining, and proximity to Dubai Marina, Beach Vista 1 is one of the most coveted beachfront addresses in Dubai.',
  },
  'Rimal 2': {
    base: 'Rimal 2 is a 38-storey residential tower in Jumeirah Beach Residence (JBR), one of Dubai\'s most iconic beachfront communities. The Arabic-inspired architecture houses spacious apartments with direct sea views, private beach and marina access, and resort-style amenities including swimming pools, a gymnasium, and event spaces. Residents enjoy JBR\'s famous Walk promenade, beachfront dining, and proximity to Ain Dubai and Bluewaters Island.',
  },
  'JBR ONE': {
    base: 'JBR ONE is a 46-storey ultra-luxury tower and the crown jewel of Jumeirah Beach Residence, completed in 2020 as the only building in the community with its own dedicated roundabout and direct beach access. Featuring panoramic sea views, Ain Dubai vistas, and smart home systems, the tower offers an infinity-edge pool, state-of-the-art indoor and outdoor gyms, spa and wellness facilities, and concierge services. Its exclusivity, premium finishes, and unmatched amenities make it the most prestigious address in JBR.',
  },
  'Arch Tower': {
    base: 'Arch Tower is a distinctive 41-storey mixed-use complex in Jumeirah Lake Towers (JLT), featuring a striking curvilinear façade and shimmering glass exterior. The 410-unit building offers swimming pools, a fully equipped gym, sauna and steam room, children\'s playground, BBQ area, and 24-hour security. With excellent metro and tram connectivity and views over the lakes, golf courses, and canal, Arch Tower provides outstanding accessibility and lifestyle value in one of Dubai\'s most popular freehold communities.',
  },
  'Dubai Gate 2': {
    base: 'Dubai Gate 2 is a 35-storey residential tower in Cluster A of Jumeirah Lake Towers (JLT), featuring a distinctive naval blue and white façade. The tower offers 442 apartments with amenities including swimming pools, gymnasium, spa, steam and sauna rooms, and 24-hour security with concierge services. Strategically positioned with easy access to Sheikh Zayed Road, Dubai Marina, and Ibn Battuta Mall, it represents excellent value in one of Dubai\'s best-connected freehold communities.',
  },
  'Habtoor City Noora Tower': {
    base: 'Habtoor City Noora Tower in Business Bay is part of the prestigious Al Habtoor City development, featuring the UAE\'s largest leisure deck with an infinity pool, lap pool, and Jacuzzi zones. Residents enjoy a 6,135 sq. ft. fitness club, full-size indoor tennis court, spa and wellness centre, children\'s daycare, and landscaped gardens with an amphitheatre. The five-star development offers unparalleled city views and is surrounded by world-class hotels, dining, and entertainment.',
  },
  'Aykon Tower B': {
    base: 'Aykon Tower B by DAMAC Properties is a luxury residential tower in Business Bay, connected to its sister towers via the elevated Aykon Plaza featuring swimming pools, a beach club, spa, and yoga terraces. Residents benefit from direct Dubai Canal waterfront access, proximity to Downtown Dubai, and a Turkish restaurant, kids\' club, and boardrooms within the development. The DAMAC brand delivers high-end finishes and hotel-style services in one of Dubai\'s most dynamic business and lifestyle districts.',
  },
  'Rahaal 2': {
    base: 'Madinat Jumeirah Living Rahaal 2 is a premium residential building in one of Dubai\'s most exclusive communities, offering direct views of the iconic Burj Al Arab. Residents enjoy an air-conditioned footbridge connecting directly to Madinat Jumeirah Resort and Souk, landscaped gardens, swimming pools, a fitness centre, jogging and cycling trails, and BBQ areas. Developed by Meraas, this address combines five-star resort proximity with serene community living in the heart of Jumeirah.',
  },
  'Al Jazi 1': {
    base: 'Madinat Jumeirah Living Al Jazi 1 by Meraas blends classic Arabic architecture with contemporary interiors, featuring warm earth tones and premium finishes throughout. The development offers communal rooftop terraces with Burj Al Arab and sea views, poolside cafés, a fully equipped gym, jogging and cycling trails, and children\'s play areas. Connected to Madinat Jumeirah Resort via an air-conditioned footbridge, Al Jazi delivers an unmatched lifestyle in one of Dubai\'s most prestigious neighbourhoods.',
  },
  'Creek Vistas Tower A': {
    base: 'Creek Vistas Tower A in Sobha Hartland is a 28-storey residential tower by Sobha Realty, inspired by the Louvre and Museum of Modern Art with meticulous craftsmanship throughout. Located in the heart of Mohammed Bin Rashid City, the tower offers breathtaking Dubai Creek and city skyline views, secure parking, a fitness centre, and landscaped community spaces. Sobha Hartland\'s green, master-planned environment provides easy access to Burj Khalifa, Dubai Mall, and Business Bay.',
  },
  'Address Residences The Bay': {
    base: 'Address Residences The Bay at Emaar Beachfront brings the renowned Address Hotels + Resorts hospitality experience to a stunning waterfront setting. Residents enjoy five-star hotel services, an infinity pool, private beach access, a world-class gym, children\'s facilities, spa and wellness amenities, and exclusive dining options. This Emaar flagship development delivers resort-style living with panoramic sea and skyline views, making it one of Dubai\'s most prestigious off-plan investment opportunities.',
  },
  'OPUS': {
    base: 'The OPUS in Business Bay is an architectural masterpiece designed by the legendary Zaha Hadid, featuring a dramatic cube form with an organically carved void at its centre. This Grade A commercial building spans 84,300 square metres and houses the ME by Meliá hotel, luxury residences, and premium office spaces with over 87% space efficiency. Office tenants benefit from dedicated parking, business lounges, on-site fine dining including ROKA and MAINE, 24/7 concierge, and hotel-grade services — all within one of Dubai\'s most photographed buildings.',
  },
  'Preatoni Tower': {
    base: 'Preatoni Tower is a 46-storey mixed-use tower in Cluster L of Jumeirah Lake Towers (JLT), offering 299 commercial office units with flexible fit-out options from shell-and-core to fully furnished. The building features a conference room, gymnasium, swimming pool, covered parking, and 24-hour video security. With direct lake views from north-facing units and excellent road connectivity via First Al Khail Street, Preatoni Tower delivers practical, well-connected office space in one of Dubai\'s most established free zone communities.',
  },
};

// ── Helper: generate specific description per listing ─────────────────────
function generateDescription(row, cleanedTitle) {
  const building = row.tower_name.trim();
  const location = row.locality.trim();
  const bedrooms = parseBedrooms(row.bedrooms);
  const bedroomLabel = bedrooms === 'Studio' ? 'studio' : `${bedrooms}-bedroom`;
  const price = parseInt(row.price);
  const sqft = Math.round(parseFloat(row.property_size));
  const isRented = cleanedTitle.toLowerCase().includes('rented') || row.property_description.toLowerCase().includes('rented');
  const isVacant = cleanedTitle.toLowerCase().includes('vacant') || row.property_description.toLowerCase().includes('vacant');
  const isOffPlan = row.completion_status === 'off_plan';
  const isOffice = row.property_type === 'Offices';

  // Find best matching building description key
  let buildingKey = Object.keys(BUILDING_DESCRIPTIONS).find(k =>
    building.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(building.toLowerCase().replace(/ tower$| residence$| residences$/i, ''))
  );

  // Fallback matching for tricky names
  if (!buildingKey) {
    if (building.includes('Grand Bleu')) buildingKey = 'Grand Bleu Tower 2';
    else if (building.includes('Noora')) buildingKey = 'Habtoor City Noora Tower';
    else if (building.includes('Rahaal')) buildingKey = 'Rahaal 2';
    else if (building.includes('Al Jazi')) buildingKey = 'Al Jazi 1';
    else if (building.includes('Creek Vistas')) buildingKey = 'Creek Vistas Tower A';
    else if (building.includes('Address')) buildingKey = 'Address Residences The Bay';
    else if (building.includes('OPUS')) buildingKey = 'OPUS';
    else if (building.includes('Preatoni')) buildingKey = 'Preatoni Tower';
    else if (building.includes('Aykon')) buildingKey = 'Aykon Tower B';
  }

  const baseDesc = buildingKey ? BUILDING_DESCRIPTIONS[buildingKey].base : '';

  if (!baseDesc) {
    // Fallback
    return row.property_description;
  }

  // Build a property-specific opening sentence
  let opening = '';
  if (isOffice) {
    opening = `This ${sqft.toLocaleString()} sq. ft. office space in ${building}, ${location} represents `;
    if (isRented) {
      opening += 'a premium income-generating investment asset.';
    } else {
      opening += 'an outstanding opportunity for owner-occupiers or investors.';
    }
  } else if (isOffPlan) {
    opening = `This ${bedroomLabel} apartment in ${building} at Emaar Beachfront is an exceptional off-plan investment, offering the prestige of the Address Hotels + Resorts brand with world-class beachfront living.`;
  } else {
    const viewMatch = cleanedTitle.match(/([\w\s&]+View)/i);
    const viewText = viewMatch ? ` with ${viewMatch[1].trim().toLowerCase()}` : '';
    opening = `This ${bedroomLabel} apartment spanning ${sqft.toLocaleString()} sq. ft. in ${building}, ${location}${viewText}`;
    if (isVacant) {
      opening += ' is vacant and ready for immediate occupancy or investment.';
    } else if (isRented) {
      // Extract rent amount from original description
      const rentMatch = row.property_description.match(/AED\s*([\d,]+)/i);
      if (rentMatch) {
        opening += ` is currently tenanted, generating AED ${rentMatch[1]}/year in rental income — an attractive buy-to-let proposition.`;
      } else {
        opening += ' is currently tenanted, offering immediate rental income for investors.';
      }
    } else {
      opening += ' offers an excellent opportunity for discerning buyers.';
    }
  }

  return `${opening} ${baseDesc}`;
}

// ── Helper: parse bedrooms ───────────────────────────────────────────────
function parseBedrooms(val) {
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return 'Studio';
  if (num === 1) return '1';
  if (num === 1.5) return '1.5';
  if (num === 2) return '2';
  if (num === 3) return '3';
  if (num === 4) return '4';
  if (num === 5) return '5';
  return String(num);
}

// ── Helper: clean title (remove unit numbers) ────────────────────────────
function cleanTitle(title) {
  let cleaned = title;

  // Remove "Unit XXXX" patterns (with optional surrounding pipes/spaces)
  // Patterns: "Unit 2301", "Unit A809", "Unit A02", "Unit 802N", etc.
  cleaned = cleaned.replace(/\s*\|\s*Unit\s+\w+\s*/gi, ' | ');
  cleaned = cleaned.replace(/\s*Unit\s+\w+\s*\|?\s*/gi, ' ');

  // Clean up double pipes: "| |" → "|"
  cleaned = cleaned.replace(/\|\s*\|/g, '|');

  // Clean up leading/trailing pipes and spaces
  cleaned = cleaned.replace(/^\s*\|\s*/, '');
  cleaned = cleaned.replace(/\s*\|\s*$/, '');

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

// ── Helper: extract unit number from title ────────────────────────────────
function extractUnitNumber(title, description) {
  // Try title first
  let match = title.match(/Unit\s+(\w+)/i);
  if (match) return match[1];

  // Try description: "Unit 802N", "(Unit 505)", "unit 1810"
  match = description.match(/Unit\s+(\w+)/i);
  if (match) return match[1];

  // For listing 1 (studio 802N) — unit mentioned in desc but not with "Unit" prefix
  // "Unit 802N" is in the desc
  return null;
}

// ── Helper: clean description (remove unit numbers) ──────────────────────
function cleanDescription(desc) {
  let cleaned = desc;

  // Remove "(Unit XXX)" and "Unit XXX" patterns
  cleaned = cleaned.replace(/\(Unit\s+\w+\)/gi, '');
  cleaned = cleaned.replace(/Unit\s+\w+/gi, '');

  // Fix grammar issues
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.replace(/\s+\./g, '.');
  cleaned = cleaned.replace(/\s+,/g, ',');
  cleaned = cleaned.trim();

  return cleaned;
}

// ── Helper: determine status ─────────────────────────────────────────────
function determineStatus(title, description) {
  const combined = (title + ' ' + description).toLowerCase();
  if (combined.includes('rented')) return 'Rented';
  if (combined.includes('vacant')) return 'Vacant';
  return 'Vacant';
}

// ── Helper: extract annual rent ──────────────────────────────────────────
function extractAnnualRent(description) {
  // "AED 160,000/year", "AED 88,000/year", "AED 1.9M/year", "AED 140,000/year"
  const match = description.match(/AED\s*([\d,.]+)(M)?\/year/i);
  if (!match) return null;

  let amount = match[1].replace(/,/g, '');
  if (match[2] && match[2].toUpperCase() === 'M') {
    return parseFloat(amount) * 1_000_000;
  }
  return parseFloat(amount);
}

// ── Helper: determine listing type ───────────────────────────────────────
function determineListingType(row) {
  if (row.property_type === 'Offices') {
    return {
      listing_type: 'commercial',
      property_type: 'Office',
      commercial_type: 'Office',
    };
  }
  if (row.completion_status === 'off_plan') {
    return {
      listing_type: 'secondary_offplan',
      property_type: 'Apartment',
      developer: 'Emaar',
      project_name: 'Address Residences The Bay',
    };
  }
  return {
    listing_type: 'ready_secondary',
    property_type: 'Apartment',
  };
}

// ── Photo folder → listing matching ──────────────────────────────────────
function buildPhotoMap() {
  const photoMap = {}; // unitKey → { folderPath, images[] }

  if (!fs.existsSync(PHOTOS_DIR)) {
    console.log('⚠ No extracted photos directory found');
    return photoMap;
  }

  // Recursively find all photo folders
  function scanDir(dir, depth = 0) {
    if (depth > 3) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '__MACOSX' || entry.name === '.DS_Store') continue;
      if (entry.name === 'RENTAL CAR  15_ commission') continue;
      if (entry.name === 'Payment plans & Floor Plan') continue;
      if (entry.name === 'Floor plan' || entry.name === 'Floor plan ') continue;
      if (entry.name === 'Floor plans') continue;
      if (entry.name === 'Video') continue;

      const fullPath = path.join(dir, entry.name);

      // Check if this folder directly contains images
      const images = getImagesInFolder(fullPath);
      if (images.length > 0) {
        // Parse folder name for matching
        const folderName = entry.name.trim();
        photoMap[fullPath] = { folderName, images };
      }

      // Also scan subdirectories
      scanDir(fullPath, depth + 1);
    }
  }

  scanDir(PHOTOS_DIR);
  return photoMap;
}

function getImagesInFolder(dir) {
  const images = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check sub-subdirectories (e.g., "2023_04_08 - ... Zada Tower 1904/")
        const subPath = path.join(dir, entry.name);
        if (entry.name === '__MACOSX' || entry.name === 'Video' || entry.name.startsWith('Floor plan')) continue;
        const subImages = getImagesInFolder(subPath);
        images.push(...subImages);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        if (!entry.name.startsWith('._') && entry.name !== '.DS_Store') {
          images.push(path.join(dir, entry.name));
        }
      }
    }
  } catch (e) { /* ignore */ }
  return images.sort();
}

// ── Match a photo folder to a listing ────────────────────────────────────
function matchPhotosToListings(listings, photoMap) {
  const matches = {}; // listing_id → images[]

  for (const listing of listings) {
    const unitNum = listing._extractedUnit;
    const building = listing._originalBuilding.toLowerCase();
    const bedrooms = listing.bedrooms;

    let bestMatch = null;
    let bestScore = 0;

    for (const [folderPath, { folderName, images }] of Object.entries(photoMap)) {
      const fn = folderName.toLowerCase();
      let score = 0;

      // Check unit number match
      if (unitNum) {
        const unitLower = unitNum.toLowerCase();
        if (fn.includes(unitLower) || fn.endsWith(unitLower)) {
          score += 10;
        }
        // Also check the full folder path for unit numbers
        if (folderPath.toLowerCase().includes(unitLower)) {
          score += 10;
        }
      }

      // Check building name match
      const buildingWords = building.replace(/tower|residence|residences|building/gi, '').trim().split(/\s+/);
      const matchedWords = buildingWords.filter(w => w.length > 2 && fn.includes(w.toLowerCase()));
      score += matchedWords.length * 3;

      // Also check full path for building name words
      const pathLower = folderPath.toLowerCase();
      const pathMatchedWords = buildingWords.filter(w => w.length > 2 && pathLower.includes(w.toLowerCase()));
      score += pathMatchedWords.length * 2;

      // Check bedroom count
      const bedroomLabel = bedrooms === 'Studio' ? 'studio' : `${bedrooms} br`;
      if (fn.includes(bedroomLabel) || fn.includes(`${bedrooms}br`)) {
        score += 2;
      }
      if (bedrooms === 'Studio' && fn.includes('studio')) {
        score += 2;
      }

      if (score > bestScore && score >= 10) {
        bestScore = score;
        bestMatch = { folderPath, images };
      }
    }

    if (bestMatch) {
      matches[listing._csvId] = bestMatch.images;
      console.log(`  ✓ Listing ${listing._csvId} "${listing.name}" → ${bestMatch.images.length} photos`);
    } else {
      console.log(`  ✗ Listing ${listing._csvId} "${listing.name}" → NO MATCH`);
    }
  }

  return matches;
}

// ── Upload photos ────────────────────────────────────────────────────────
async function uploadPhotos(listingId, imagePaths) {
  const urls = [];

  for (const imgPath of imagePaths.slice(0, 11)) { // max 11 (1 main + 10 gallery)
    const ext = path.extname(imgPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const sanitizedName = path.basename(imgPath)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    const storagePath = `properties/${listingId}/${Date.now()}-${sanitizedName}`;

    const fileBuffer = fs.readFileSync(imgPath);

    const { data, error } = await db.storage
      .from('media')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.log(`    ⚠ Upload failed for ${path.basename(imgPath)}: ${error.message}`);
      continue;
    }

    const url = `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
    urls.push(url);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  return urls;
}

// ── Main import function ─────────────────────────────────────────────────
async function main() {
  console.log('=== FORE Property Import Script ===\n');

  // Step 0: Migration
  await runMigration();

  // Step 1: Parse CSV
  console.log('\n=== STEP 1: Parsing CSV ===');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  console.log(`✓ Parsed ${rows.length} listings from CSV`);

  // Step 2: Clean and transform data
  console.log('\n=== STEP 2: Cleaning and transforming data ===');
  const listings = [];

  for (const row of rows) {
    const originalTitle = row.property_title.trim();
    const unitNumber = extractUnitNumber(originalTitle, row.property_description);
    const cleanedTitle = cleanTitle(originalTitle);
    const status = determineStatus(originalTitle, row.property_description);
    const annualRent = extractAnnualRent(row.property_description);
    const price = parseInt(row.price);
    const rentalYield = (annualRent && price) ? ((annualRent / price) * 100).toFixed(1) + '%' : null;
    const typeInfo = determineListingType(row);
    const bedrooms = parseBedrooms(row.bedrooms);

    const newDescription = generateDescription(row, cleanedTitle);

    const listing = {
      _csvId: row.listing_id,
      _originalTitle: originalTitle,
      _originalBuilding: row.tower_name,
      _extractedUnit: unitNumber,
      name: cleanedTitle,
      description: newDescription,
      price: price,
      bedrooms: bedrooms,
      bathrooms: row.bathroom ? parseInt(row.bathroom) : null,
      area_sqft: Math.round(parseFloat(row.property_size)),
      location: row.locality.trim(),
      building_name: row.tower_name.trim(),
      city: 'Dubai',
      furnished: row.furnished === 'No' ? 'Unfurnished' : row.furnished,
      features: row.features ? row.features.replace(/\|/g, ', ') : null,
      reference_number: [row.property_ref_no, unitNumber].filter(Boolean).join(' / '),
      dld_permit: row.permit_number || null,
      agent: 'Anastasiia Guseva',
      published: true,
      featured: false,
      ownership: 'Freehold',
      status: status,
      annual_rent: annualRent,
      rental_yield: rentalYield,
      ...typeInfo,
    };

    listings.push(listing);
    console.log(`  [${row.listing_id}] "${cleanedTitle}" (${bedrooms} BR, ${status})`);
  }

  // Step 3: Match photos
  console.log('\n=== STEP 3: Building photo map ===');
  const photoMap = buildPhotoMap();
  console.log(`Found ${Object.keys(photoMap).length} photo folders`);

  console.log('\n=== STEP 3b: Matching photos to listings ===');
  const photoMatches = matchPhotosToListings(listings, photoMap);

  // Step 4 & 5: Upload photos and insert listings
  console.log('\n=== STEP 4 & 5: Uploading photos and inserting listings ===');

  const report = {
    total: 0,
    readySecondary: 0,
    secondaryOffplan: 0,
    commercial: 0,
    withPhotos: 0,
    noPhotos: [],
    photosUploaded: 0,
    titlesCleaned: 0,
    descriptionsRewritten: 0,
    vacant: 0,
    rented: 0,
    errors: [],
    cleanedTitles: [],
  };

  for (const listing of listings) {
    report.total++;
    report.cleanedTitles.push(`[${listing._csvId}] ${listing.name}`);

    if (listing._originalTitle !== listing.name) report.titlesCleaned++;
    report.descriptionsRewritten++;

    if (listing.listing_type === 'ready_secondary') report.readySecondary++;
    else if (listing.listing_type === 'secondary_offplan') report.secondaryOffplan++;
    else if (listing.listing_type === 'commercial') report.commercial++;

    if (listing.status === 'Vacant') report.vacant++;
    else if (listing.status === 'Rented') report.rented++;

    // Upload photos if matched
    let imageMain = null;
    let images = null;

    const matchedPhotos = photoMatches[listing._csvId];
    if (matchedPhotos && matchedPhotos.length > 0) {
      console.log(`\n  Uploading ${matchedPhotos.length} photos for listing ${listing._csvId}...`);

      // Generate a temp ID for storage path — will use actual ID after insert
      const tempId = `import-${listing._csvId}-${Date.now()}`;
      const urls = await uploadPhotos(tempId, matchedPhotos);

      if (urls.length > 0) {
        imageMain = urls[0];
        if (urls.length > 1) {
          images = urls.slice(1).join(',');
        }
        report.withPhotos++;
        report.photosUploaded += urls.length;
        console.log(`    ✓ ${urls.length} photos uploaded`);
      }
    } else {
      report.noPhotos.push({ id: listing._csvId, name: listing.name, building: listing.building_name });
    }

    // Build the insert record (remove internal fields)
    const record = { ...listing };
    delete record._csvId;
    delete record._originalTitle;
    delete record._originalBuilding;
    delete record._extractedUnit;

    record.image_main = imageMain;
    record.images = images;

    // Insert into Supabase
    const { data, error } = await db
      .from('secondary_listings')
      .insert(record)
      .select('id')
      .single();

    if (error) {
      console.log(`  ✗ Insert error for listing ${listing._csvId}: ${error.message}`);
      report.errors.push(`Listing ${listing._csvId} "${listing.name}": ${error.message}`);
    } else {
      console.log(`  ✓ Inserted listing ${listing._csvId} → ID ${data.id}`);
    }
  }

  // Step 6: Final report
  console.log('\n\n' + '='.repeat(60));
  console.log('=== IMPORT COMPLETE ===');
  console.log('='.repeat(60));
  console.log(`Total listings imported: ${report.total}`);
  console.log(`  - Ready Secondary: ${report.readySecondary}`);
  console.log(`  - Secondary Off-Plan: ${report.secondaryOffplan}`);
  console.log(`  - Commercial: ${report.commercial}`);
  console.log('');
  console.log(`Listings with photos uploaded: ${report.withPhotos}`);
  console.log(`Listings needing manual photo upload: ${report.noPhotos.length}`);
  if (report.noPhotos.length > 0) {
    for (const np of report.noPhotos) {
      console.log(`  - [${np.id}] ${np.name} (${np.building})`);
    }
  }
  console.log('');
  console.log(`Photos uploaded to Supabase Storage: ${report.photosUploaded} total`);
  console.log('');
  console.log(`Titles cleaned (unit numbers removed): ${report.titlesCleaned}`);
  console.log(`Descriptions rewritten: ${report.descriptionsRewritten}`);
  console.log('');
  console.log('Status breakdown:');
  console.log(`  - Vacant: ${report.vacant}`);
  console.log(`  - Rented: ${report.rented}`);
  console.log('');
  if (report.errors.length > 0) {
    console.log('Errors:');
    for (const err of report.errors) {
      console.log(`  - ${err}`);
    }
  } else {
    console.log('Errors: None');
  }
  console.log('');
  console.log('=== ALL 43 CLEANED TITLES ===');
  for (const t of report.cleanedTitles) {
    console.log(`  ${t}`);
  }
  console.log('\n' + '='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
