export default async function handler(req, res) {
  // Set CORS headers so local development works (Vercel automatically configures CORS on same domain in prod)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { code, code_verifier, client_id, redirect_uri } = req.body || {};

  if (!code || !code_verifier || !client_id || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    console.log(`Exchanging code for client_id: ${client_id}`);
    const tokenRes = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id,
        code,
        code_verifier,
        redirect_uri,
      }),
    });

    const data = await tokenRes.json();
    return res.status(tokenRes.status).json(data);
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.status(500).json({ error: 'Failed to perform token exchange', details: err.message });
  }
}
