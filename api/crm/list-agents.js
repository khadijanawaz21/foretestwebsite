// Admin-only: active agent roster, for the assign-lead dropdown.
// `agents` has no anon-read RLS policy (same lockdown as `leads`), so
// this has to be a server route rather than a direct client query.
const { requireCrmRole } = require('../../shared/crm/auth');

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const identity = await requireCrmRole(req, res, ['admin']);
  if (!identity) return;

  const serviceKey = process.env.SERVICE_KEY;
  const params = new URLSearchParams({
    select: 'id,name,email',
    active: 'eq.true',
    order: 'name.asc',
  });

  const upstream = await fetch(`${SUPABASE_URL}/rest/v1/agents?${params.toString()}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!upstream.ok) {
    console.error('[api/crm/list-agents] Supabase error', await upstream.text());
    return res.status(500).json({ error: 'Failed to load agents' });
  }

  res.status(200).json({ agents: await upstream.json() });
};
