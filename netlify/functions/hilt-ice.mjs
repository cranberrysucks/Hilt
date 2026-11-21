// Hilt relay: hands the game short-lived Cloudflare TURN credentials.
// Netlify environment variables (Site configuration → Environment variables):
//   HILT_TURN_KEY_ID  = the TURN key ID from Cloudflare (Realtime → TURN Server)
//   HILT_TURN_TOKEN   = that key's API token
// The secret stays on Netlify; browsers only ever get credentials that expire.

export default async () => {
  const id = process.env.HILT_TURN_KEY_ID, token = process.env.HILT_TURN_TOKEN;
  const json = (body, status = 200, cache = 'no-store') =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } });
  if (!id || !token) return json({ iceServers: [], error: 'HILT_TURN_KEY_ID / HILT_TURN_TOKEN not set' });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }), // credentials last 24 hours
    });
    if (!r.ok) return json({ iceServers: [], error: `Cloudflare answered ${r.status}` }, 502);
    const d = await r.json();
    let ice = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
    // browsers block port 53; drop those URLs so connections don't wait on them
    ice = ice.map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) })).filter(s => s.urls.length);
    return json({ iceServers: ice }, 200, 'private, max-age=3600');
  } catch (e) {
    return json({ iceServers: [], error: String(e && e.message || e) }, 502);
  }
};

export const config = { path: '/api/hilt-ice' };
