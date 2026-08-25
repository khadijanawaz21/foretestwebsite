/**
 * Dubai 20/80 campaign — configuration & data layer.
 *
 * Everything a non-developer needs to update for this landing page lives
 * here. No prices, sizes, ROI, handover dates, or developer claims are
 * hard-coded in index.html — if a field below is left null/empty, the
 * corresponding section on the page hides itself or falls back to a
 * generic, non-fabricated message instead of showing invented data.
 *
 * After editing this file, redeploy (git commit + push) for changes to
 * go live — this is a static file, not a CMS.
 */
window.CAMPAIGN_CONFIG = {
  // ── Campaign identity (used for lead attribution, not shown to visitors) ──
  campaignName: 'dubai_20_80',
  landingPagePath: '/20-80',

  // ── Payment plan structure (the campaign's core, verified offer) ──
  // A generic 20/80 split: 20% during construction (this may include a
  // booking payment plus further instalments — the split WITHIN the 20%
  // varies by project and developer, so it isn't broken out further
  // here), and the remaining 80% at handover. Do not add a fixed
  // booking/construction sub-split unless it's confirmed for every
  // project on this campaign — the page already discloses that it varies.
  paymentPlan: {
    construction: 20,  // % during construction (booking + any staged instalments)
    handover: 80,      // % at handover
  },

  // ── WhatsApp (reused from the site-wide configured number — do not
  // change unless the company's WhatsApp number itself changes) ──
  whatsappNumber: '971542445867',
  whatsappMessage: "Hi, I'm interested in the Dubai 20/80 payment plan. Please send me the available options and prices.",

  // ── Starting price ──
  // Left null deliberately: no verified campaign-specific starting price
  // exists yet. The "see your payments" calculator on the page is built
  // as an interactive tool (visitor types in a price) instead of showing
  // an invented figure. If/when a verified starting price is confirmed,
  // set it here (a plain number, AED, e.g. 750000) and the page will
  // show it as the default calculator value instead.
  startingPriceAED: null,

  // ── Property types ──
  // Empty by default — the "Property Types" section only renders if this
  // array has entries, per verified campaign data. Fill in only types
  // that are genuinely available right now. Shape:
  // { type: 'Studio', priceFromAED: 650000, sizeFromSqft: 380, feature: 'Fully furnished', whatsapp: true }
  propertyTypes: [],

  // ── Handover ──
  // Left null: no verified handover date exists yet. Shown only if set
  // (plain text, e.g. "Q4 2027").
  handover: null,

  // ── Developer ──
  // Left null: no single verified developer is confirmed for this
  // campaign yet. If a specific developer is confirmed, set their name
  // here (must match a real, verified partner).
  developer: null,

  // ── Meta Pixel ──
  // Left null: no Meta Pixel is installed anywhere on the site today.
  // Set this to your Pixel ID (a string of digits from Meta Events
  // Manager) to activate PageView / ViewContent / Contact / Lead
  // tracking on this page. Until set, all tracking calls are inert.
  metaPixelId: null,
};
