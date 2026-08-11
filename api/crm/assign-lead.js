// Admin-only: assign a lead to an agent. Writes the assignment, a
// lead_activity audit row (event_type 'assigned', already valid in the
// original Phase 1 schema — no migration needed for this part), and
// best-effort emails the agent via the existing Resend integration —
// same sendEmail() call shape api/leads.js already uses.
const { requireCrmRole } = require('../../shared/crm/auth');
const { leadAssignedEmail } = require('../../shared/email/templates');
const { sendEmail } = require('../../shared/email/resend');

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

async function fetchOne(table, query, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new Error(`${table} lookup failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const identity = await requireCrmRole(req, res, ['admin']);
  if (!identity) return;

  const serviceKey = process.env.SERVICE_KEY;
  const { leadId, agentId } = req.body || {};
  if (!leadId || !agentId) {
    return res.status(400).json({ error: 'leadId and agentId are required' });
  }

  try {
    const agent = await fetchOne(
      'agents',
      `select=id,name,email,active&id=eq.${encodeURIComponent(agentId)}&limit=1`,
      serviceKey
    );
    if (!agent || !agent.active) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        agent_id: agentId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      }),
    });
    if (!updateRes.ok) {
      throw new Error(`lead update failed (${updateRes.status}): ${await updateRes.text()}`);
    }
    const lead = (await updateRes.json())[0];
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

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
          lead_id: lead.id,
          event_type: 'assigned',
          to_value: agent.name,
          actor_type: 'admin',
          actor_identifier: identity.authUserId,
        },
      ]),
    });

    // Best-effort, same posture as api/leads.js: the assignment itself is
    // already saved — a notification failure must not fail the request.
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL;
      if (!resendApiKey || !fromEmail) {
        console.error('[api/crm/assign-lead] email_not_configured', { leadId: lead.id });
      } else {
        const email = leadAssignedEmail(lead, agent);
        await sendEmail(resendApiKey, {
          to: agent.email,
          from: fromEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
      }
    } catch (emailErr) {
      console.error('[api/crm/assign-lead] notify_failed', { leadId: lead.id, error: String(emailErr) });
    }

    res.status(200).json({ success: true, lead });
  } catch (err) {
    console.error('[api/crm/assign-lead] error', err);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
};
