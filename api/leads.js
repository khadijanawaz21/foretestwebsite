const crypto = require('crypto');
const { FORE_INBOX, leadNotificationEmail, leadConfirmationEmail } = require('../shared/email/templates');
const { sendEmail } = require('../shared/email/resend');

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

const VALID_SOURCES = ['homepage', 'contact', 'golden-visa', 'academy', 'property-enquiry'];

const IP_LIMIT_COUNT = 10;
const IP_LIMIT_WINDOW_MINUTES = 15;
const EMAIL_LIMIT_COUNT = 3;
const EMAIL_LIMIT_WINDOW_HOURS = 24;

const MAX_LENGTHS = {
  fullName: 255,
  firstName: 255,
  lastName: 255,
  email: 255,
  phone: 64,
  country: 255,
  message: 5000,
  sourceUrl: 2048,
  referrer: 2048,
  utmSource: 255,
  utmMedium: 255,
  utmCampaign: 255,
  propertyId: 255,
  propertyTitle: 500,
  propertyUrl: 2048,
};
const MAX_DETAILS_JSON_LENGTH = 10000;

// Every top-level field the endpoint understands. Anything else in the
// request body falls through into `details` automatically (see buildDetails).
const KNOWN_FIELDS = new Set([
  'source', 'firstName', 'lastName', 'fullName', 'email', 'phone', 'country',
  'message', 'propertyId', 'propertyTitle', 'propertyUrl', 'sourceUrl',
  'referrer', 'utmSource', 'utmMedium', 'utmCampaign', 'privacyAccepted',
  'website',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function logRejection(reason, meta) {
  console.error('[api/leads] rejected', { reason, ...meta });
}

function trimStr(v) {
  return typeof v === 'string' ? v.trim() : v;
}

function collapseWhitespace(v) {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  const xri = req.headers['x-real-ip'];
  if (xri && String(xri).trim()) return String(xri).trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function normalizeIp(ip) {
  return String(ip || '').trim().toLowerCase();
}

// Keyed HMAC, not plain SHA-256: an unsalted hash of an IPv4 address is
// trivially reversible (brute-forcing all ~4.3B addresses is cheap), which
// would defeat the point of not storing the raw IP. IP_HASH_SECRET must be
// set (see handler below) so ip_hash can't be reversed without it.
function hashIp(ip, secret) {
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

// Trims strings, lowercases source/email, collapses whitespace in names.
// Runs before any validation, per Phase 2 design.
function normalizeBody(body) {
  const out = { ...body };

  if (typeof out.source === 'string') out.source = out.source.trim().toLowerCase();
  if (typeof out.email === 'string') out.email = out.email.trim().toLowerCase();
  if (typeof out.phone === 'string') out.phone = out.phone.trim();

  out.firstName = collapseWhitespace(out.firstName);
  out.lastName = collapseWhitespace(out.lastName);
  out.fullName = collapseWhitespace(out.fullName);
  out.country = trimStr(out.country);
  out.message = trimStr(out.message);
  out.propertyId = trimStr(out.propertyId);
  out.propertyTitle = trimStr(out.propertyTitle);
  out.propertyUrl = trimStr(out.propertyUrl);
  out.sourceUrl = trimStr(out.sourceUrl);
  out.referrer = trimStr(out.referrer);
  out.utmSource = trimStr(out.utmSource);
  out.utmMedium = trimStr(out.utmMedium);
  out.utmCampaign = trimStr(out.utmCampaign);
  out.website = trimStr(out.website);

  return out;
}

// Residual capture: everything not in KNOWN_FIELDS falls into `details`
// automatically, so new form fields don't require an API change.
function buildDetails(body) {
  const details = {};
  for (const key of Object.keys(body)) {
    if (!KNOWN_FIELDS.has(key)) details[key] = body[key];
  }
  return details;
}

function deriveFullName(body) {
  if (body.fullName) return body.fullName;
  const parts = [body.firstName, body.lastName].filter(Boolean);
  return parts.join(' ').trim();
}

// Structural validation against the normalized body. Returns a reason
// string on failure (used for server-side logging only), or null if valid.
function validate(body, fullName) {
  if (!fullName) return 'validation_failed';
  if (!body.source || !VALID_SOURCES.includes(body.source)) return 'invalid_source';
  if (!body.email || !EMAIL_RE.test(body.email)) return 'invalid_email';

  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    const value = body[field];
    if (typeof value === 'string' && value.length > max) return 'validation_failed';
  }

  if (body.privacyAccepted !== undefined && typeof body.privacyAccepted !== 'boolean') {
    return 'validation_failed';
  }

  return null;
}

// Plain filtered SELECT with a LIMIT, not a Range/count=exact request —
// deliberately avoids relying on Content-Range parsing for the zero-match
// case, which is unverified PostgREST behavior and would false-fail every
// first-time submitter (the most common case) if it didn't come back the
// way we assumed. A plain GET is always 200 with a possibly-empty array,
// no ambiguity.
async function isRateLimited(column, value, sinceIso, limit, serviceKey) {
  const url = `${SUPABASE_URL}/rest/v1/leads?select=id&${column}=eq.${encodeURIComponent(value)}&created_at=gte.${encodeURIComponent(sinceIso)}&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase rate-limit check failed on ${column} (${res.status}): ${errText}`);
  }
  const rows = await res.json();
  return rows.length >= limit;
}

async function insertLead(row, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify([row]),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase lead insert failed (${res.status}): ${errText}`);
  }
  const result = await res.json();
  return result[0];
}

async function insertLeadActivity(leadId, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      lead_id: leadId,
      event_type: 'created',
      actor_type: 'system',
    }]),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase lead_activity insert failed (${res.status}): ${errText}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceKey = process.env.SERVICE_KEY;
  const ipHashSecret = process.env.IP_HASH_SECRET;
  if (!serviceKey || !ipHashSecret) {
    logRejection('server_error', { detail: !serviceKey ? 'SERVICE_KEY not configured' : 'IP_HASH_SECRET not configured' });
    return res.status(500).json({ error: 'Unable to process request' });
  }

  const rawBody = req.body && typeof req.body === 'object' ? req.body : {};
  const ip = normalizeIp(getClientIp(req));
  const ipHash = hashIp(ip, ipHashSecret);

  // Honeypot — a bot filling the hidden field gets a success-shaped
  // response with no insert, so the trap isn't revealed.
  if (typeof rawBody.website === 'string' && rawBody.website.trim() !== '') {
    logRejection('honeypot', { source: rawBody.source, ipHash });
    return res.status(200).json({ success: true });
  }

  const body = normalizeBody(rawBody);
  const fullName = deriveFullName(body);

  const invalidReason = validate(body, fullName);
  if (invalidReason) {
    logRejection(invalidReason, { source: body.source, ipHash });
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const sinceIp = new Date(Date.now() - IP_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    if (await isRateLimited('ip_hash', ipHash, sinceIp, IP_LIMIT_COUNT, serviceKey)) {
      logRejection('rate_limited_ip', { source: body.source, ipHash });
      return res.status(429).json({ error: 'Too many requests' });
    }

    const sinceEmail = new Date(Date.now() - EMAIL_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    if (await isRateLimited('email', body.email, sinceEmail, EMAIL_LIMIT_COUNT, serviceKey)) {
      logRejection('rate_limited_email', { source: body.source, ipHash });
      return res.status(429).json({ error: 'Too many requests' });
    }

    const details = buildDetails(rawBody);
    const detailsJson = JSON.stringify(details);
    if (detailsJson.length > MAX_DETAILS_JSON_LENGTH) {
      logRejection('validation_failed', { source: body.source, ipHash, detail: 'details too large' });
      return res.status(400).json({ error: 'Invalid request' });
    }

    const row = {
      full_name: fullName,
      first_name: body.fullName ? null : (body.firstName || null),
      last_name: body.fullName ? null : (body.lastName || null),
      email: body.email,
      phone: body.phone || null,
      country: body.country || null,
      message: body.message || null,
      details,
      source: body.source,
      source_url: body.sourceUrl || null,
      referrer: body.referrer || null,
      utm_source: body.utmSource || null,
      utm_medium: body.utmMedium || null,
      utm_campaign: body.utmCampaign || null,
      property_id: body.propertyId || null,
      property_title: body.propertyTitle || null,
      property_url: body.propertyUrl || null,
      privacy_accepted: typeof body.privacyAccepted === 'boolean' ? body.privacyAccepted : null,
      ip_hash: ipHash,
    };

    const lead = await insertLead(row, serviceKey);

    // The lead itself is already saved at this point — a failure here is
    // a secondary audit-trail write, not a reason to tell the client their
    // submission failed (that would invite a duplicate resubmission of
    // data that's already safely stored).
    try {
      await insertLeadActivity(lead.id, serviceKey);
    } catch (activityErr) {
      console.error('[api/leads] lead_activity_insert_failed', { leadId: lead.id, error: String(activityErr) });
    }

    // Best-effort, optional: email is never allowed to affect the response
    // or the outcome of the lead capture itself. Wrapped in its own
    // try/catch (not just Promise.allSettled around the sends) because
    // template construction itself runs synchronously here — without this,
    // a throw during construction would fall through to the outer catch
    // and return a false 500 for a lead that was already saved.
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL;
      if (!resendApiKey || !fromEmail) {
        console.error('[api/leads] email_not_configured', { leadId: lead.id });
      } else {
        const notification = leadNotificationEmail(lead);
        const confirmation = leadConfirmationEmail(lead);

        const [notificationResult, confirmationResult] = await Promise.allSettled([
          sendEmail(resendApiKey, {
            to: FORE_INBOX,
            from: fromEmail,
            replyTo: lead.email,
            subject: notification.subject,
            html: notification.html,
            text: notification.text,
          }),
          sendEmail(resendApiKey, {
            to: lead.email,
            from: fromEmail,
            subject: confirmation.subject,
            html: confirmation.html,
            text: confirmation.text,
          }),
        ]);

        if (notificationResult.status === 'rejected') {
          console.error('[api/leads] internal_email_failed', { leadId: lead.id, error: String(notificationResult.reason) });
        }
        if (confirmationResult.status === 'rejected') {
          console.error('[api/leads] confirmation_email_failed', { leadId: lead.id, error: String(confirmationResult.reason) });
        }
      }
    } catch (emailErr) {
      console.error('[api/leads] email_failed', { leadId: lead.id, error: String(emailErr) });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[api/leads] server_error', err);
    return res.status(500).json({ error: 'Unable to process request' });
  }
};
