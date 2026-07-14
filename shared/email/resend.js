const RESEND_API_URL = 'https://api.resend.com/emails';

// Operational-debugging headers only, per Phase 3 design — not read by any
// code in this project, just visible in Resend's dashboard/logs and raw
// email headers.
const SYSTEM_HEADERS = {
  'X-FORE-System': 'Lead Platform',
  'X-FORE-Version': '1.1',
};

async function sendEmail(apiKey, { to, from, replyTo, subject, html, text }) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyTo || undefined,
      subject,
      html,
      text,
      headers: SYSTEM_HEADERS,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${errText}`);
  }

  return res.json();
}

module.exports = { sendEmail };
