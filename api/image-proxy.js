// Proxies external images to avoid CORS issues in the browser.
// Usage: /api/image-proxy?url=https://example.com/photo.jpg

const ALLOWED_HOSTS = [
  'famknekdbtrmxopywgsj.supabase.co',
  'www.fairopportunityrealestate.com',
  'fairopportunityrealestate.com',
];

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).send('Invalid url'); }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).send('Host not allowed');
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).send('Upstream error');

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Proxy fetch failed');
  }
};
