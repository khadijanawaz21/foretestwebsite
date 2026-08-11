/**
 * One-time CRM account provisioning — REVIEW BEFORE RUNNING.
 *
 * Creates a real Supabase Auth identity for each CRM admin (explicit
 * list below — deliberately NOT inferred from the `agents` table) and
 * each active row already in `agents`, via Supabase's invite-link flow:
 * nobody's password is set by this script or known to anyone but the
 * recipient — supabase.auth.admin.generateLink({type:'invite'}) creates
 * the identity and returns a one-time link; the recipient sets their
 * own password when they open it.
 *
 * Delivery mode (CRM_INVITE_MODE):
 *   - unset / anything other than 'manual' (default): emails the link via
 *     FORE's existing Resend integration (shared/email/resend.js), using
 *     the crmInviteEmail template. Requires RESEND_API_KEY/RESEND_FROM_EMAIL.
 *   - 'manual': for testing before Resend's sending domain is configured.
 *     Never touches Resend, never requires those two vars. Instead prints
 *     the raw Supabase invite link to the terminal, clearly marked as
 *     sensitive, for you to hand-deliver yourself. The link grants full
 *     account access to whoever opens it — copy it only within the
 *     terminal session, never into a file, chat log, or anything else
 *     that gets saved or committed. This mode must be opted into
 *     explicitly per run (`CRM_INVITE_MODE=manual node ...`) — it is not
 *     the default, specifically so it can't activate by accident.
 *
 * Targeting a single account (CRM_INVITE_EMAIL, optional):
 *   - unset (default): provisions every address in ADMIN_EMAILS plus every
 *     active `agents` row — the original full-roster behavior.
 *   - set: provisions ONLY that one email. Matched case-insensitively
 *     against ADMIN_EMAILS first, then against active agents' emails; if
 *     it matches neither, the script throws before creating anything —
 *     no Supabase Auth call, no DB write. Meant for exactly this: testing
 *     one admin and one agent by hand before trusting a full run.
 *
 * Links the new identity back to the roster via
 * agents.auth_user_id / crm_admins.auth_user_id (both added by
 * scripts/migration-crm-leads-extension.sql — run that migration
 * first).
 *
 * Requires env: SUPABASE_URL is hardcoded below (same project as every
 * other script in this repo); SERVICE_KEY and SITE_BASE_URL always;
 * RESEND_API_KEY / RESEND_FROM_EMAIL only when CRM_INVITE_MODE is not
 * 'manual'.
 *
 * Safe to re-run: skips any admin/agent that already has an
 * auth_user_id linked, and reuses an existing Supabase Auth account by
 * email instead of erroring if one already exists (e.g. from a partial
 * previous run).
 *
 * Usage (once ADMIN_EMAILS below is filled in and reviewed):
 *   node scripts/setup-crm-accounts.mjs                        (emails everyone via Resend)
 *   CRM_INVITE_MODE=manual CRM_INVITE_EMAIL=someone@x.com node scripts/setup-crm-accounts.mjs
 *                                                              (prints one link, touches nobody else)
 *
 * Do NOT run this until you've filled in ADMIN_EMAILS and are ready for
 * real invites to go out — by email or by hand.
 */
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../shared/email/resend.js';
import { crmInviteEmail } from '../shared/email/templates.js';

const SUPABASE_URL = 'https://famknekdbtrmxopywgsj.supabase.co';

// 'manual' must be opted into explicitly — every other value (including
// unset) keeps the real Resend-email path, so this can't silently take
// over in production.
const INVITE_MODE = process.env.CRM_INVITE_MODE === 'manual' ? 'manual' : 'email';

// Where the invite link lands after Supabase verifies it and establishes
// a session. Must be added to Authentication → URL Configuration →
// Redirect URLs in the Supabase dashboard first — an un-allow-listed
// redirectTo is silently ignored by Supabase in favor of the project's
// default Site URL, which would strand the recipient somewhere with no
// "set your password" UI at all.
function inviteRedirectUrl(siteBaseUrl) {
  return `${siteBaseUrl.replace(/\/$/, '')}/crm-set-password.html`;
}

// ── Explicit CRM admin roster ──────────────────────────────────────
// Add the real email address(es) for whoever should have full CRM admin
// access (sees every lead, assigns to agents). Deliberately not derived
// from `agents` — being an agent (a job title / roster entry) is not
// the same thing as being a CRM admin, and the two must not be
// conflated. Leave empty and this script does nothing but report that.
const ADMIN_EMAILS = [
  'khadija@fairopportunityrealestate.com',
  'customercare@fairopportunityrealestate.com',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function findExistingAuthUserId(supabase, email) {
  // supabase-js v2 has no getUserByEmail; page through listUsers().
  // Roster sizes here are small (single-digit agents + a couple of
  // admins), so one unpaginated page is enough in practice — if this
  // ever needs to scale, page via { page, perPage }.
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const match = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  return match ? match.id : null;
}

async function inviteAndLink(supabase, { email, name, role, resendApiKey, fromEmail, redirectTo }) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  let authUserId;
  if (error) {
    const alreadyRegistered = /already.*registered/i.test(error.message || '');
    if (!alreadyRegistered) throw error;

    authUserId = await findExistingAuthUserId(supabase, email);
    if (!authUserId) throw new Error(`${email}: invite failed as "already registered" but no matching user found`);
    console.log(`- ${email} already has a Supabase Auth account — linking without a new invite`);
  } else {
    authUserId = data.user.id;
    const inviteLink = data.properties.action_link;

    if (INVITE_MODE === 'manual') {
      console.log(`\n+ generated invite for ${email} (${role}) — SENSITIVE, do not share, log, or commit this:`);
      console.log(`  ${inviteLink}\n`);
    } else {
      const email_ = crmInviteEmail({ name, inviteLink, role });
      await sendEmail(resendApiKey, {
        to: email,
        from: fromEmail,
        subject: email_.subject,
        html: email_.html,
        text: email_.text,
      });
      console.log(`+ invited ${email} (${role})`);
    }
  }

  return authUserId;
}

async function main() {
  const serviceKey = requireEnv('SERVICE_KEY');
  const siteBaseUrl = requireEnv('SITE_BASE_URL');
  const redirectTo = inviteRedirectUrl(siteBaseUrl);
  const targetEmail = process.env.CRM_INVITE_EMAIL || null;

  let resendApiKey = null;
  let fromEmail = null;

  if (INVITE_MODE === 'manual') {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║ CRM_INVITE_MODE=manual — TEST MODE, NOT PRODUCTION BEHAVIOR    ║');
    console.log('║ Invite links will be PRINTED below, not emailed.               ║');
    console.log('║ Each link grants full account access to whoever opens it —    ║');
    console.log('║ treat it like a password. Deliver it yourself, out of this     ║');
    console.log('║ terminal only — never paste it into a file, chat log, or       ║');
    console.log('║ anything else that gets saved or committed.                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
  } else {
    resendApiKey = requireEnv('RESEND_API_KEY');
    fromEmail = requireEnv('RESEND_FROM_EMAIL');
  }

  if (ADMIN_EMAILS.length === 0 && !targetEmail) {
    console.log('ADMIN_EMAILS is empty and CRM_INVITE_EMAIL is not set — nothing to do. Exiting without doing anything.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, serviceKey);

  // Fetched once, up front — needed for a full run either way, and to
  // validate a CRM_INVITE_EMAIL target against the roster before
  // anything is created.
  const { data: agents, error: agentsErr } = await supabase
    .from('agents')
    .select('id, name, email, active, auth_user_id')
    .eq('active', true);
  if (agentsErr) throw agentsErr;

  let adminEmailsToProvision = ADMIN_EMAILS;
  let agentsToProvision = agents;

  if (targetEmail) {
    const normalizedTarget = targetEmail.toLowerCase();
    const matchesAdmin = ADMIN_EMAILS.some((e) => e.toLowerCase() === normalizedTarget);
    const matchingAgent = agents.find((a) => (a.email || '').toLowerCase() === normalizedTarget);

    if (matchesAdmin) {
      console.log(`CRM_INVITE_EMAIL set — restricting this run to ${targetEmail} only (admin). Nobody else will be touched.`);
      adminEmailsToProvision = [targetEmail];
      agentsToProvision = [];
    } else if (matchingAgent) {
      console.log(`CRM_INVITE_EMAIL set — restricting this run to ${targetEmail} only (agent). Nobody else will be touched.`);
      adminEmailsToProvision = [];
      agentsToProvision = [matchingAgent];
    } else {
      throw new Error(
        `CRM_INVITE_EMAIL=${targetEmail} matches neither ADMIN_EMAILS nor an active agent — refusing to provision anything. Fix the email or the roster and try again.`
      );
    }
  }

  console.log('Provisioning admins...');
  for (const email of adminEmailsToProvision) {
    // inviteAndLink itself skips generating a new invite if a Supabase
    // Auth account for this email already exists (see its "already
    // registered" branch) — the upsert below is then just a no-op
    // re-link, safe on every re-run.
    const authUserId = await inviteAndLink(supabase, { email, name: email, role: 'admin', resendApiKey, fromEmail, redirectTo });
    const { error: upsertErr } = await supabase.from('crm_admins').upsert({ auth_user_id: authUserId });
    if (upsertErr) throw upsertErr;
  }

  console.log('Provisioning agents...');
  for (const agent of agentsToProvision) {
    if (agent.auth_user_id) {
      console.log(`- ${agent.email} already linked, skipping`);
      continue;
    }
    const authUserId = await inviteAndLink(supabase, {
      email: agent.email,
      name: agent.name,
      role: 'agent',
      resendApiKey,
      fromEmail,
      redirectTo,
    });
    const { error: updateErr } = await supabase.from('agents').update({ auth_user_id: authUserId }).eq('id', agent.id);
    if (updateErr) throw updateErr;
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
