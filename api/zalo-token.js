/* ========================================
   🔵 Vercel Serverless: Zalo Token Exchange
   Giữ secret_key an toàn trên server
   ======================================== */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, code_verifier } = req.body || {};
  if (!code || !code_verifier) {
    return res.status(400).json({ error: 'Missing code or code_verifier', received: { hasCode: !!code, hasVerifier: !!code_verifier } });
  }

  // Trim env vars to remove possible newlines from deployment
  const ZALO_APP_ID = (process.env.VITE_ZALO_APP_ID || '').trim();
  const ZALO_SECRET = (process.env.ZALO_APP_SECRET || '').trim();

  if (!ZALO_APP_ID || !ZALO_SECRET) {
    return res.status(500).json({ 
      error: 'Zalo credentials not configured',
      debug: { hasAppId: !!ZALO_APP_ID, hasSecret: !!ZALO_SECRET, appIdLen: ZALO_APP_ID.length, secretLen: ZALO_SECRET.length }
    });
  }

  try {
    // Exchange code for token with Zalo
    const body = new URLSearchParams({
      app_id: ZALO_APP_ID,
      grant_type: 'authorization_code',
      code,
      code_verifier,
    });

    const tokenRes = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': ZALO_SECRET,
      },
      body: body.toString(),
    });

    const tokenData = await tokenRes.json();
    
    if (tokenData.error || !tokenData.access_token) {
      return res.status(400).json({ 
        error: 'Zalo token exchange failed',
        zalo_error: tokenData.error,
        zalo_error_name: tokenData.error_name,
        zalo_error_desc: tokenData.error_description,
        zalo_error_reason: tokenData.error_reason,
      });
    }

    // Get user info
    const userRes = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
      headers: { 'access_token': tokenData.access_token },
    });

    const userInfo = await userRes.json();

    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      user: {
        id: userInfo.id,
        name: userInfo.name || '',
        picture: userInfo.picture?.data?.url || '',
      },
    });
  } catch (err) {
    console.error('Zalo token exchange error:', err);
    return res.status(500).json({ error: 'Token exchange failed', message: err.message });
  }
}
