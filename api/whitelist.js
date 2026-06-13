export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { account_to_whitelist, admin_account_id, admin_token } = req.body || {};

  if (!account_to_whitelist || !admin_account_id || !admin_token) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // 1. Verify admin account is authorized to do this
  const allowedAdminAccounts = ['ROT91833970', 'DOT93132805'];
  const formattedAdmin = admin_account_id.trim().toUpperCase();
  const formattedTarget = account_to_whitelist.trim().toUpperCase();

  if (!allowedAdminAccounts.includes(formattedAdmin)) {
    return res.status(403).json({ error: 'Unauthorized: This account does not have developer privileges.' });
  }

  // 2. Validate token with Deriv REST API
  try {
    const derivAppId = process.env.VITE_DERIV_APP_ID || '33xCanrA7freeICOdpEoH';
    const derivRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
      method: 'GET',
      headers: {
        'Deriv-App-ID': derivAppId,
        'Authorization': `Bearer ${admin_token}`
      }
    });

    if (!derivRes.ok) {
      const errText = await derivRes.text();
      return res.status(401).json({ error: `Deriv authentication failed: ${errText}` });
    }

    const derivData = await derivRes.json();
    const accounts = derivData.data || [];
    
    // Check if the provided admin_account_id is actually owned by the token holder
    const ownsAccount = accounts.some(acc => acc.account_id.trim().toUpperCase() === formattedAdmin);
    if (!ownsAccount) {
      return res.status(401).json({ error: 'Authentication mismatch: Token does not match the provided admin account.' });
    }
  } catch (err) {
    console.error('Deriv validation error:', err);
    return res.status(500).json({ error: 'Failed to validate credentials with Deriv API', details: err.message });
  }

  // 3. Write to Supabase allowed_users
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dqylesrwkgupnflyveth.supabase.co';
    // Use service role key to bypass RLS, fallback to anon key if service role is not defined
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxeWxlc3J3a2d1cG5mbHl2ZXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTcyMDIsImV4cCI6MjA5Njg3MzIwMn0.ll4lznpvJsSkXM6Z8Uf1kL6q-L5Mn3JAtx4QdxoXtyg';

    console.log(`Whitelisting ${formattedTarget} in Supabase table "allowed_users"...`);
    
    // Check if already in DB first
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/allowed_users?account_id=eq.${formattedTarget}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData && checkData.length > 0) {
        return res.status(200).json({ success: true, message: `Account ${formattedTarget} is already whitelisted.` });
      }
    }

    // Insert new row
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/allowed_users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        account_id: formattedTarget
      })
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return res.status(insertRes.status).json({ error: `Supabase database error: ${errText}` });
    }

    const insertedData = await insertRes.json();
    return res.status(200).json({ success: true, data: insertedData, message: `Account ${formattedTarget} successfully whitelisted.` });
  } catch (err) {
    console.error('Supabase write error:', err);
    return res.status(500).json({ error: 'Failed to write to whitelist database', details: err.message });
  }
}
