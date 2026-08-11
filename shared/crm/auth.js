// Server-side auth helper for the in-house CRM's api/crm/*.js routes.
// Verifies a Supabase Auth JWT (sent by the browser as a Bearer token,
// from a real supabase.auth.signInWithPassword() session — see
// crm-login.html) and resolves it to a CRM role by checking the
// service-role-only `crm_admins` and `agents` tables. Never trusts a
// client-supplied role.
//
// Plain fetch against Supabase's REST/Auth endpoints throughout, to
// match the existing api/leads.js / api/sync-pf-listings.js convention
// rather than introducing @supabase/supabase-js into the serverless
// function layer.

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

// Verifies the JWT against Supabase's GoTrue endpoint. Returns the auth
// user object, or null if the token is missing/invalid/expired.
async function getAuthUser(token, serviceKey) {
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: serviceKey,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function findCrmAdmin(authUserId, serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_admins?select=auth_user_id&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) throw new Error(`crm_admins lookup failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  return rows.length > 0;
}

async function findAgentByAuthUserId(authUserId, serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agents?select=id,name,email,active&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) throw new Error(`agents lookup failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

// Resolves the caller's CRM identity + role from the request's bearer
// JWT. Returns null if there's no valid Supabase session at all, or
// { role: 'admin' | 'agent' | 'none', authUserId, agent? }. 'none' means
// a real, currently-logged-in Supabase account that isn't in
// crm_admins and isn't linked to an active agents row — e.g. a
// deactivated agent, or an account that was never granted CRM access.
async function resolveCrmIdentity(req, serviceKey) {
  const token = getBearerToken(req);
  const authUser = await getAuthUser(token, serviceKey);
  if (!authUser || !authUser.id) return null;

  const authUserId = authUser.id;

  const isAdmin = await findCrmAdmin(authUserId, serviceKey);
  if (isAdmin) return { role: 'admin', authUserId };

  const agent = await findAgentByAuthUserId(authUserId, serviceKey);
  if (agent && agent.active) return { role: 'agent', authUserId, agent };

  return { role: 'none', authUserId };
}

// Route guard: resolves identity, enforces `allowedRoles`, and sends the
// 401/403/500 response itself on failure. Returns the identity object on
// success, or null (response already sent) on failure — callers should
// `if (!identity) return;` immediately after calling this.
async function requireCrmRole(req, res, allowedRoles) {
  const serviceKey = process.env.SERVICE_KEY;
  if (!serviceKey) {
    res.status(500).json({ error: 'Server not configured' });
    return null;
  }

  let identity;
  try {
    identity = await resolveCrmIdentity(req, serviceKey);
  } catch (err) {
    console.error('[crm/auth] identity resolution failed', err);
    res.status(500).json({ error: 'Unable to verify session' });
    return null;
  }

  if (!identity) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (!allowedRoles.includes(identity.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return identity;
}

module.exports = { requireCrmRole, resolveCrmIdentity };
