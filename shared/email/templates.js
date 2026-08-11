const BRAND = {
  gold: '#C9A96E',
  lightGray: '#999',
  logoUrl: 'https://fairopportunityrealestate.com/brand_assets/logo.png',
  siteUrl: 'https://fairopportunityrealestate.com',
  address: 'Office 3602, 36th Floor, Burj Al Salam Tower, Trade Center, Dubai, UAE',
  instagram: 'https://www.instagram.com/fore_dubai/',
  linkedin: 'https://www.linkedin.com/company/fair-opportunity-real-estate/',
};

const FORE_INBOX = 'info@fairopportunityrealestate.com';

const SOURCE_LABELS = {
  homepage: 'Homepage',
  contact: 'Contact',
  'golden-visa': 'Golden Visa',
  academy: 'Academy',
  'property-enquiry': 'Property Enquiry',
  bayut: 'Bayut',
  propertyfinder: 'Property Finder',
};

function sourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "Received" timestamp for the internal notification — always Dubai time,
// regardless of where the lead physically originated.
function formatDubaiTime(isoString) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
  return `${formatted} (Asia/Dubai)`;
}

// Shared header/footer wrapper — matches the email-safe FORE branding
// already used in email-signatures/ (table layout, web-safe fonts, gold
// accent bars). The site's dark cinematic theme doesn't survive email
// client rendering reliably, so this is the deliberate email adaptation
// of the brand, not a departure from it.
function baseLayout({ bodyHtml }) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;border-collapse:collapse;max-width:600px;width:100%;background:#ffffff;">
  <tr><td style="height:4px;background:${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr>
    <td style="padding:32px 32px 24px 32px;">
      <a href="${BRAND.siteUrl}"><img src="${BRAND.logoUrl}" height="48" alt="FORE" style="display:block;border:0;height:48px;width:auto;margin-bottom:24px;"></a>
      ${bodyHtml}
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;border-top:1px solid #eee;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
        <td style="font-size:11px;color:${BRAND.lightGray};line-height:1.6;">
          FORE — Fair Opportunity Real Estate<br>
          ${BRAND.address}
        </td>
        <td style="text-align:right;vertical-align:top;white-space:nowrap;">
          <a href="${BRAND.instagram}" style="text-decoration:none;"><img src="https://img.icons8.com/ios-filled/20/C9A96E/instagram-new.png" width="18" height="18" alt="Instagram" style="border:0;margin-left:6px;"></a>
          <a href="${BRAND.linkedin}" style="text-decoration:none;"><img src="https://img.icons8.com/ios-filled/20/C9A96E/linkedin.png" width="18" height="18" alt="LinkedIn" style="border:0;margin-left:6px;"></a>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="height:4px;background:${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`;
}

function detailRow(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="font-size:11px;color:${BRAND.lightGray};text-transform:uppercase;letter-spacing:1px;padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="font-size:13px;color:#1a1a1a;padding:6px 0;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

function leadNotificationEmail(lead) {
  const subject = `New Lead • ${sourceLabel(lead.source)} • ${lead.full_name}`;

  const rows = [
    detailRow('Reference', lead.id),
    detailRow('Received', formatDubaiTime(lead.created_at)),
    detailRow('Source', sourceLabel(lead.source)),
    detailRow('Name', lead.full_name),
    detailRow('Email', lead.email),
    detailRow('Phone', lead.phone),
    detailRow('Country', lead.country),
    detailRow('Property', lead.property_title),
    detailRow('Property URL', lead.property_url),
    detailRow('Message', lead.message),
  ].join('');

  const bodyHtml = `
    <h1 style="font-size:18px;color:#1a1a1a;margin:0 0 16px 0;">New lead received</h1>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${rows}</table>
  `;

  const textLines = [
    'New lead received',
    '',
    `Reference: ${lead.id}`,
    `Received: ${formatDubaiTime(lead.created_at)}`,
    `Source: ${sourceLabel(lead.source)}`,
    `Name: ${lead.full_name}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.country ? `Country: ${lead.country}` : null,
    lead.property_title ? `Property: ${lead.property_title}` : null,
    lead.property_url ? `Property URL: ${lead.property_url}` : null,
    lead.message ? `Message: ${lead.message}` : null,
  ].filter(Boolean);

  return {
    subject,
    html: baseLayout({ bodyHtml }),
    text: textLines.join('\n'),
  };
}

function leadConfirmationEmail(lead) {
  const subject = `We've received your enquiry`;
  const firstName = lead.first_name || lead.full_name.split(' ')[0];

  const bodyHtml = `
    <h1 style="font-size:20px;font-weight:400;color:#1a1a1a;margin:0 0 16px 0;">Thank you, ${escapeHtml(firstName)}.</h1>
    <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 16px 0;">
      We've received your enquiry and a member of the FORE team will be in touch shortly.
      We respond within one business day.
    </p>
    <p style="font-size:14px;color:#333;line-height:1.7;margin:0;">
      — The FORE Team
    </p>
  `;

  const text = [
    `Thank you, ${firstName}.`,
    '',
    "We've received your enquiry and a member of the FORE team will be in touch shortly. We respond within one business day.",
    '',
    '— The FORE Team',
  ].join('\n');

  return {
    subject,
    html: baseLayout({ bodyHtml }),
    text,
  };
}

function leadAssignedEmail(lead, agent) {
  const subject = `New lead assigned: ${lead.full_name}`;

  const rows = [
    detailRow('Reference', lead.id),
    detailRow('Source', sourceLabel(lead.source)),
    detailRow('Name', lead.full_name),
    detailRow('Email', lead.email),
    detailRow('Phone', lead.phone),
    detailRow('Property', lead.property_title),
    detailRow('Message', lead.message),
  ].join('');

  const bodyHtml = `
    <h1 style="font-size:18px;color:#1a1a1a;margin:0 0 16px 0;">A lead has been assigned to you, ${escapeHtml(agent.name.split(' ')[0])}</h1>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="font-size:13px;color:#333;line-height:1.7;margin:16px 0 0 0;">Please follow up as soon as possible and update the lead's status in the CRM.</p>
  `;

  const textLines = [
    `A lead has been assigned to you, ${agent.name.split(' ')[0]}`,
    '',
    `Reference: ${lead.id}`,
    `Source: ${sourceLabel(lead.source)}`,
    `Name: ${lead.full_name}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.property_title ? `Property: ${lead.property_title}` : null,
    lead.message ? `Message: ${lead.message}` : null,
    '',
    "Please follow up as soon as possible and update the lead's status in the CRM.",
  ].filter(Boolean);

  return {
    subject,
    html: baseLayout({ bodyHtml }),
    text: textLines.join('\n'),
  };
}

// Sent once per CRM account by scripts/setup-crm-accounts.mjs — never by
// any live route. `inviteLink` is a Supabase Auth invite action_link
// (see supabase.auth.admin.generateLink({type:'invite',...})); the
// recipient sets their own password there, so no password is ever
// generated or transmitted by this script or this template.
function crmInviteEmail({ name, inviteLink, role }) {
  const subject = 'Set up your FORE CRM access';
  const roleLabel = role === 'admin' ? 'admin' : 'agent';
  const firstName = (name || '').split(' ')[0] || name;

  const bodyHtml = `
    <h1 style="font-size:20px;font-weight:400;color:#1a1a1a;margin:0 0 16px 0;">Hi ${escapeHtml(firstName)},</h1>
    <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 16px 0;">
      You've been set up with ${roleLabel} access to the FORE CRM. Use the link below to set your password and sign in.
    </p>
    <p style="margin:0 0 24px 0;">
      <a href="${inviteLink}" style="display:inline-block;background:${BRAND.gold};color:#1a1a1a;padding:12px 24px;text-decoration:none;font-size:14px;border-radius:2px;">Set up my account</a>
    </p>
    <p style="font-size:12px;color:${BRAND.lightGray};line-height:1.6;margin:0;">
      If the button doesn't work, copy and paste this link into your browser:<br>${escapeHtml(inviteLink)}
    </p>
  `;

  const text = [
    `Hi ${firstName},`,
    '',
    `You've been set up with ${roleLabel} access to the FORE CRM. Use the link below to set your password and sign in.`,
    '',
    inviteLink,
  ].join('\n');

  return {
    subject,
    html: baseLayout({ bodyHtml }),
    text,
  };
}

module.exports = {
  FORE_INBOX,
  leadNotificationEmail,
  leadConfirmationEmail,
  leadAssignedEmail,
  crmInviteEmail,
};
