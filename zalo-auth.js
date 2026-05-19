/* ========================================
   🔵 ZALO LOGIN — OAuth 2.0 with PKCE
   Miễn phí 100% · Bảo mật cao
   ======================================== */

// ============================================================
// CONFIG — Lấy từ .env (VITE_ prefix cho Vite)
// ============================================================
const ZALO_APP_ID = import.meta.env.VITE_ZALO_APP_ID || '';
const ZALO_APP_SECRET = import.meta.env.VITE_ZALO_APP_SECRET || '';

// Tự động detect callback URL dựa trên domain hiện tại
function getRedirectUri() {
  const base = window.location.origin;
  return `${base}/`;  // Callback trả về trang chủ
}

// ============================================================
// PKCE HELPERS (RFC 7636)
// ============================================================

// Tạo code_verifier: random 43-128 ký tự
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

// Tạo code_challenge = Base64URL(SHA256(code_verifier))
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

// Base64URL encode (no padding)
function base64urlEncode(buffer) {
  return btoa(String.fromCharCode.apply(null, buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ============================================================
// ZALO OAUTH FLOW
// ============================================================

/**
 * Bước 1: Redirect user tới Zalo để đăng nhập
 * TX bấm nút → redirect → Zalo xác thực → redirect về app kèm ?code=xxx
 */
export async function startZaloLogin() {
  const state = crypto.randomUUID ? crypto.randomUUID() : 'timgo_' + Date.now();
  const codeVerifier = generateCodeVerifier();
  localStorage.setItem('zalo_state', state);
  localStorage.setItem('zalo_code_verifier', codeVerifier);
  localStorage.setItem('zalo_login_time', Date.now().toString());

  if (!ZALO_APP_ID || ZALO_APP_ID === '1234567890987654321') {
    console.warn('🟡 Đang dùng MOCK ZALO LOGIN (Sandbox) do chưa cấu hình App ID thật!');
    
    // Giả lập redirect tới Zalo và quay lại ngay (Sandbox mode)
    const mockUrl = new URL(window.location.href);
    mockUrl.hash = ''; // Xoá #admin nếu có
    mockUrl.searchParams.set('code', 'MOCK_ZALO_CODE_987');
    mockUrl.searchParams.set('state', state);
    
    setTimeout(() => {
      window.location.href = mockUrl.toString();
    }, 1500); // delay để nhìn thấy trạng thái loading
    
    return { redirecting: true };
  }
  
  // Real OAuth Login
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUri = encodeURIComponent(getRedirectUri());
  const url = `https://oauth.zaloapp.com/v4/permission?app_id=${ZALO_APP_ID}&redirect_uri=${redirectUri}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;
  
  window.location.href = url;
  return { redirecting: true };
}

/**
 * Bước 2: Xử lý callback khi Zalo redirect về
 * Tự động gọi khi page load nếu có ?code= trong URL
 * Returns: { success, user } hoặc { error }
 */
export async function handleZaloCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  if (!code) return null; // Không phải callback
  
  // Verify state chống CSRF
  const savedState = localStorage.getItem('zalo_state');
  if (state !== savedState) {
    cleanupCallback();
    return { error: 'Phiên đăng nhập bị gián đoạn. Vui lòng thử lại!' };
  }
  
  // Check expiry (5 phút)
  const loginTime = parseInt(localStorage.getItem('zalo_login_time') || '0');
  if (Date.now() - loginTime > 5 * 60 * 1000) {
    cleanupCallback();
    return { error: 'Mã xác thực hết hạn. Vui lòng thử lại!' };
  }
  
  const codeVerifier = localStorage.getItem('zalo_code_verifier');
  if (!codeVerifier) {
    cleanupCallback();
    return { error: 'Thiếu thông tin xác thực. Vui lòng thử lại!' };
  }
  
  // =====================
  // Sandbox / Mock Mode
  // =====================
  if (code === 'MOCK_ZALO_CODE_987') {
    console.warn('🟡 Chấp nhận MOCK_ZALO_CODE!');
    cleanupCallback();
    // Stable mock ID per device (dùng localStorage để persist qua page reload)
    let stableId = localStorage.getItem('zalo_mock_stable_id');
    if (!stableId) {
      const ua = navigator.userAgent || 'default';
      let hash = 0;
      for (let i = 0; i < ua.length; i++) { hash = ((hash << 5) - hash) + ua.charCodeAt(i); hash |= 0; }
      stableId = 'zalo_mock_' + Math.abs(hash);
      localStorage.setItem('zalo_mock_stable_id', stableId);
    }
    return {
      success: true,
      zalo_id: stableId,
      name: 'Tài xế Zalo Test',
      avatar: 'https://ui-avatars.com/api/?name=Zalo+Test&background=0068FF&color=fff',
      access_token: 'mock_token_' + Date.now(),
      refresh_token: 'mock_refresh_' + Date.now(),
    };
  }

  // =====================
  // Real Token Exchange
  // =====================
  try {
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code, codeVerifier);
    if (tokenData.error) {
      cleanupCallback();
      return { error: `Lỗi Zalo: ${tokenData.error_description || tokenData.error}` };
    }
    
    // Get user info from Zalo
    const userInfo = await getZaloUserInfo(tokenData.access_token);
    if (userInfo.error) {
      cleanupCallback();
      return { error: 'Không lấy được thông tin Zalo. Thử lại!' };
    }
    
    cleanupCallback();
    return {
      success: true,
      zalo_id: userInfo.id,
      name: userInfo.name || '',
      avatar: userInfo.picture?.data?.url || '',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    };
  } catch (err) {
    console.error('Zalo callback error:', err);
    cleanupCallback();
    return { error: 'Lỗi kết nối máy chủ Zalo. Vui lòng kiểm tra mạng!' };
  }
}

/**
 * Exchange authorization code for access token
 * Note: Cần secret_key — ở client-side cho MVP, production nên chuyển sang server
 */
async function exchangeCodeForToken(code, codeVerifier) {
  // Thử gọi qua Vercel API route trước (bảo mật hơn)
  const apiRoute = `${window.location.origin}/api/zalo-token`;
  
  try {
    const serverRes = await fetch(apiRoute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier }),
    });
    
    const serverData = await serverRes.json();
    if (serverRes.ok) {
      return serverData;
    }
    // Server route returned error — log it and return it
    console.error('API /zalo-token error:', serverData);
    return { error: serverData.error || 'server_error', error_description: JSON.stringify(serverData) };
  } catch (e) {
    console.error('API route fetch failed:', e);
    // Server route không có → fallback client-side
  }
  
  // Fallback: Client-side exchange (cho development/MVP)
  if (!ZALO_APP_SECRET) {
    return { error: 'missing_secret', error_description: 'Cần cấu hình VITE_ZALO_APP_SECRET hoặc Vercel API route' };
  }
  
  const res = await fetch('https://oauth.zaloapp.com/v4/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'secret_key': ZALO_APP_SECRET,
    },
    body: new URLSearchParams({
      app_id: ZALO_APP_ID,
      grant_type: 'authorization_code',
      code: code,
      code_verifier: codeVerifier,
    }),
  });
  
  return await res.json();
}

/**
 * Get user info from Zalo Graph API
 */
async function getZaloUserInfo(accessToken) {
  const res = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
    headers: { 'access_token': accessToken },
  });
  return await res.json();
}

/**
 * Clean up sessionStorage after callback
 */
function cleanupCallback() {
  localStorage.removeItem('zalo_code_verifier');
  localStorage.removeItem('zalo_state');
  localStorage.removeItem('zalo_login_time');
  // Clean URL params
  const url = new URL(window.location);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, '', url.pathname + url.hash);
}

/**
 * Check nếu Zalo Login đã cấu hình
 */
export function isZaloConfigured() {
  return !!ZALO_APP_ID;
}

/**
 * Get Zalo App ID (for display)
 */
export function getZaloAppId() {
  return ZALO_APP_ID;
}
