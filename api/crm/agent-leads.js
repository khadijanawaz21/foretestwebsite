// Agent-only: leads assigned to the calling agent, and nothing else.
// The scoping is enforced server-side using the agent id resolved from
// the caller's verified session (shared/crm/auth.js) — never from a
// client-supplied id.
const { requireCrmRole } = require('../../shared/crm/auth');

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const identity = await requireCrmRole(req, res, ['agent']);
  if (!identity) return;

  const serviceKey = process.env.SERVICE_KEY;
  const params = new URLSearchParams({
    select:
      'id,full_name,email,phone,source,status,message,property_title,property_url,lead_type,assigned_at,created_at',
    agent_id: `eq.${identity.agent.id}`,
    order: 'created_at.desc',
  });

  const upstream = await fetch(`${SUPABASE_URL}/rest/v1/leads?${params.toString()}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!upstream.ok) {
    console.error('[api/crm/agent-leads] Supabase error', await upstream.text());
    return res.status(500).json({ error: 'Failed to load leads' });
  }

  res.status(200).json({ leads: await upstream.json() });
};
