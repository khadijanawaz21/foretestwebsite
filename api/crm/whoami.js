// Returns the CRM role for the currently-authenticated Supabase Auth
// session, so crm.html knows whether to render the admin or agent view.
// Never trusts anything from the client except the bearer JWT itself —
// role is always resolved server-side (see shared/crm/auth.js).
const { requireCrmRole } = require('../../shared/crm/auth');

module.exports = async function handler(req, res) {
  const identity = await requireCrmRole(req, res, ['admin', 'agent']);
  if (!identity) return;

  res.status(200).json({
    role: identity.role,
    agent: identity.agent ? { id: identity.agent.id, name: identity.agent.name } : null,
  });
};
