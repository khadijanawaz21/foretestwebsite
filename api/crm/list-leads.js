// Admin-only: the full leads inbox, filterable by source/status/agent.
// `leads` has no anon-read RLS policy (PII must never be reachable via
// the anon key — see scripts/create-leads-platform-tables.sql), so this
// goes through SERVICE_KEY server-side, same posture as api/leads.js's
// writes.
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
  const { source, status, agent } = req.query;

  const params = new URLSearchParams();
  params.set(
    'select',
    'id,full_name,email,phone,source,status,message,property_title,property_url,lead_type,agent_id,assigned_at,created_at,agents(name)'
  );
  params.set('order', 'created_at.desc');
  params.set('limit', '500');
  if (source) params.set('source', `eq.${source}`);
  if (status) params.set('status', `eq.${status}`);
  if (agent === 'unassigned') params.set('agent_id', 'is.null');
  else if (agent) params.set('agent_id', `eq.${agent}`);

  const upstream = await fetch(`${SUPABASE_URL}/rest/v1/leads?${params.toString()}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!upstream.ok) {
    console.error('[api/crm/list-leads] Supabase error', await upstream.text());
    return res.status(500).json({ error: 'Failed to load leads' });
  }

  res.status(200).json({ leads: await upstream.json() });
};
