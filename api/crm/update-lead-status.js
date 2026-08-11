// Agent-or-admin: move a lead through the status pipeline. Agents may
// only touch their own assigned leads (enforced below against the
// server-resolved identity, not anything the client sends); admins can
// touch any lead. Requires the widened lead_activity.actor_type check
// (scripts/migration-crm-leads-extension.sql — adds 'agent' alongside
// the original 'system'/'admin') to be applied first.
const { requireCrmRole } = require('../../shared/crm/auth');

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';
const ALLOWED_STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'won', 'lost', 'closed'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const identity = await requireCrmRole(req, res, ['admin', 'agent']);
  if (!identity) return;

  const serviceKey = process.env.SERVICE_KEY;
  const { leadId, status } = req.body || {};
  if (!leadId || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const lookupParams = new URLSearchParams({
      select: 'id,agent_id,status,contacted_at,closed_at',
      id: `eq.${leadId}`,
      limit: '1',
    });
    const lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?${lookupParams.toString()}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!lookupRes.ok) throw new Error(`lead lookup failed (${lookupRes.status}): ${await lookupRes.text()}`);
    const existing = (await lookupRes.json())[0];
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    if (identity.role === 'agent' && existing.agent_id !== identity.agent.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const patch = { status };
    if (status === 'contacted' && !existing.contacted_at) patch.contacted_at = new Date().toISOString();
    if (['closed', 'won', 'lost'].includes(status) && !existing.closed_at) patch.closed_at = new Date().toISOString();

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    });
    if (!updateRes.ok) throw new Error(`lead update failed (${updateRes.status}): ${await updateRes.text()}`);
    const updated = (await updateRes.json())[0];

    await fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([
        {
          lead_id: leadId,
          event_type: 'status_changed',
          from_value: existing.status,
          to_value: status,
          actor_type: identity.role,
          actor_identifier: identity.authUserId,
        },
      ]),
    });

    res.status(200).json({ success: true, lead: updated });
  } catch (err) {
    console.error('[api/crm/update-lead-status] error', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
};
