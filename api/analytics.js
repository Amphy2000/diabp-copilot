export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dqylesrwkgupnflyveth.supabase.co';
  // Use service role key to bypass RLS
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxeWxlc3J3a2d1cG5mbHl2ZXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTcyMDIsImV4cCI6MjA5Njg3MzIwMn0.ll4lznpvJsSkXM6Z8Uf1kL6q-L5Mn3JAtx4QdxoXtyg';

  // ════════════════════════════════════════════
  // 1. GET METHOD: Retrieve Admin Analytics
  // ════════════════════════════════════════════
  if (req.method === 'GET') {
    const { admin_account_id, admin_token } = req.query;

    if (!admin_account_id || !admin_token) {
      return res.status(400).json({ error: 'Missing admin credentials' });
    }

    const allowedAdminAccounts = ['ROT91833970', 'DOT93132805'];
    const formattedAdmin = admin_account_id.trim().toUpperCase();

    if (!allowedAdminAccounts.includes(formattedAdmin)) {
      return res.status(403).json({ error: 'Unauthorized: This account does not have developer privileges.' });
    }

    // Validate token with Deriv API
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
        return res.status(401).json({ error: 'Deriv authentication failed' });
      }

      const derivData = await derivRes.json();
      const accounts = derivData.data || [];
      const ownsAccount = accounts.some(acc => acc.account_id.trim().toUpperCase() === formattedAdmin);
      if (!ownsAccount) {
        return res.status(401).json({ error: 'Authentication mismatch' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to validate credentials with Deriv', details: err.message });
    }

    // Query aggregates from Supabase bot_sessions
    try {
      // 1. Fetch recent sessions
      const sessionsRes = await fetch(`${supabaseUrl}/rest/v1/bot_sessions?order=updated_at.desc&limit=30`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!sessionsRes.ok) {
        throw new Error('Failed to fetch sessions from database');
      }
      const sessions = await sessionsRes.json();

      // 2. Fetch all sessions for aggregations (lightweight load since it only returns fields needed)
      const allRes = await fetch(`${supabaseUrl}/rest/v1/bot_sessions?select=account_id,traded_volume,trades_count,is_demo`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!allRes.ok) {
        throw new Error('Failed to fetch aggregation data');
      }
      const allData = await allRes.json();

      let totalVolume = 0.0;
      let totalTrades = 0;
      const uniqueUsers = new Set();

      allData.forEach(row => {
        // Only sum volume and trades for REAL accounts to prevent demo play money from polluting statistics
        if (row.is_demo === false || row.is_demo === 'false') {
          totalVolume += parseFloat(row.traded_volume || 0);
          totalTrades += parseInt(row.trades_count || 0);
        }
        if (row.account_id) {
          uniqueUsers.add(row.account_id.trim().toUpperCase());
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          totalVolume,
          totalTrades,
          uniqueUsersCount: uniqueUsers.size,
          estimatedCommission: totalVolume * 0.01, // 1% commission calculation
          totalSessions: allData.length
        },
        sessions
      });
    } catch (err) {
      console.error('Analytics fetch error:', err);
      return res.status(500).json({ error: 'Failed to retrieve analytics', details: err.message });
    }
  }

  // ════════════════════════════════════════════
  // 2. POST METHOD: Record Session (Client)
  // ════════════════════════════════════════════
  if (req.method === 'POST') {
    const {
      session_id,
      account_id,
      is_demo,
      trades_count,
      wins_count,
      losses_count,
      traded_volume,
      net_profit
    } = req.body || {};

    if (!account_id) {
      return res.status(400).json({ error: 'Missing account_id parameter' });
    }

    try {
      const formattedAcct = account_id.trim().toUpperCase();
      const payload = {
        account_id: formattedAcct,
        is_demo: !!is_demo,
        trades_count: parseInt(trades_count || 0),
        wins_count: parseInt(wins_count || 0),
        losses_count: parseInt(losses_count || 0),
        traded_volume: parseFloat(traded_volume || 0),
        net_profit: parseFloat(net_profit || 0),
        updated_at: new Date().toISOString()
      };

      let resUrl = `${supabaseUrl}/rest/v1/bot_sessions`;
      let fetchOptions = {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      };

      if (session_id) {
        // Update existing session
        resUrl += `?id=eq.${session_id}`;
        fetchOptions.method = 'PATCH';
      } else {
        // Create new session
        fetchOptions.method = 'POST';
      }

      const dbRes = await fetch(resUrl, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body
      });

      if (!dbRes.ok) {
        const errText = await dbRes.text();
        return res.status(dbRes.status).json({ error: `Database error: ${errText}` });
      }

      const dbData = await dbRes.json();
      const recordedSessionId = (dbData && dbData.length > 0) ? dbData[0].id : session_id;

      return res.status(200).json({
        success: true,
        session_id: recordedSessionId,
        message: 'Session analytics recorded successfully.'
      });
    } catch (err) {
      console.error('Analytics write error:', err);
      return res.status(500).json({ error: 'Failed to record analytics', details: err.message });
    }
  }

  // ════════════════════════════════════════════
  // 3. DELETE METHOD: Clear Real Account Analytics
  // ════════════════════════════════════════════
  if (req.method === 'DELETE') {
    const { admin_account_id, admin_token } = req.query;

    if (!admin_account_id || !admin_token) {
      return res.status(400).json({ error: 'Missing admin credentials' });
    }

    const allowedAdminAccounts = ['ROT91833970', 'DOT93132805'];
    const formattedAdmin = admin_account_id.trim().toUpperCase();

    if (!allowedAdminAccounts.includes(formattedAdmin)) {
      return res.status(403).json({ error: 'Unauthorized: This account does not have developer privileges.' });
    }

    // Validate token with Deriv API
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
        return res.status(401).json({ error: 'Deriv authentication failed' });
      }

      const derivData = await derivRes.json();
      const accounts = derivData.data || [];
      const ownsAccount = accounts.some(acc => acc.account_id.trim().toUpperCase() === formattedAdmin);
      if (!ownsAccount) {
        return res.status(401).json({ error: 'Authentication mismatch' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to validate credentials with Deriv', details: err.message });
    }

    // Delete real sessions from Supabase bot_sessions
    try {
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/bot_sessions?is_demo=eq.false`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        }
      });

      if (!dbRes.ok) {
        const errText = await dbRes.text();
        return res.status(dbRes.status).json({ error: `Database error: ${errText}` });
      }

      const deletedData = await dbRes.json();
      return res.status(200).json({
        success: true,
        message: `Successfully deleted ${deletedData ? deletedData.length : 0} real trading sessions.`,
        deleted: deletedData
      });
    } catch (err) {
      console.error('Analytics delete error:', err);
      return res.status(500).json({ error: 'Failed to clear real sessions from database', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
