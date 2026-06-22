const BASE_URL = import.meta.env.VITE_API_URL;

// ── Token storage ────────────────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem('cg_access_token');
}
export function getRefreshToken() {
  return localStorage.getItem('cg_refresh_token');
}
function storeTokens(accessToken, refreshToken) {
  localStorage.setItem('cg_access_token', accessToken);
  if (refreshToken) localStorage.setItem('cg_refresh_token', refreshToken);
}
export function getStoredUsername() {
  const stored = localStorage.getItem('cg_username');
  if (stored) return stored;
  // Fall back to the JWT payload for sessions predating username storage.
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username || null;
  } catch {
    return null;
  }
}
function storeUsername(username) {
  if (username) localStorage.setItem('cg_username', username);
}
export function clearTokens() {
  localStorage.removeItem('cg_access_token');
  localStorage.removeItem('cg_refresh_token');
  localStorage.removeItem('cg_username');
}

// ── Base fetch with auto-refresh ─────────────────────────────────────────────

async function apiFetch(path, options = {}, retry = true) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) { clearTokens(); throw new Error('Not authenticated'); }
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshRes.ok) { clearTokens(); throw new Error('Session expired'); }
    const { accessToken } = await refreshRes.json();
    storeTokens(accessToken, null);
    return apiFetch(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body });
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function register(username, email, password) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  storeTokens(data.accessToken, data.refreshToken);
  storeUsername(data.username);
  return data;
}

export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  storeTokens(data.accessToken, data.refreshToken);
  storeUsername(data.username);
  return data;
}

export function logout() {
  clearTokens();
}

// ── Player account ───────────────────────────────────────────────────────────

export function getMe() {
  return apiFetch('/api/card-game/me');
}

// ── Collection ───────────────────────────────────────────────────────────────

export function getCollection(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  return apiFetch(`/api/card-game/collection${params ? `?${params}` : ''}`);
}

// ── Tickets ──────────────────────────────────────────────────────────────────

export function getTickets() {
  return apiFetch('/api/card-game/tickets');
}

export function getEligibleCards(rarity) {
  return apiFetch(`/api/card-game/tickets/${rarity}/eligible-cards`);
}

export function redeemTicket(rarity, cardDefId) {
  return apiFetch(`/api/card-game/tickets/${rarity}/redeem`, {
    method: 'POST',
    body: JSON.stringify({ cardDefId }),
  });
}

// ── Gacha ────────────────────────────────────────────────────────────────────

export function completeOnboarding() {
  return apiFetch('/api/card-game/onboarding/complete', { method: 'POST' });
}

export function claimDailyPull(genderCategory = 'gg') {
  return apiFetch('/api/card-game/daily-pull/claim', {
    method: 'POST',
    body: JSON.stringify({ genderCategory }),
  });
}

export function getBanners() {
  return apiFetch('/api/card-game/banners');
}

export function pullBanner(bannerId, rateUpIdolId, count = 1) {
  return apiFetch(`/api/card-game/banners/${bannerId}/pull`, {
    method: 'POST',
    body: JSON.stringify({ rateUpIdolId, count }),
  });
}

// ── Songs & lineup ───────────────────────────────────────────────────────────

export function getWeeklySongs(genderCategory) {
  return apiFetch(`/api/card-game/songs/weekly?genderCategory=${genderCategory}`);
}

export function getLineup(genderCategory) {
  return apiFetch(`/api/card-game/lineup/${genderCategory}`);
}

export function saveLineup(genderCategory, songId, slots) {
  return apiFetch(`/api/card-game/lineup/${genderCategory}`, {
    method: 'PUT',
    body: JSON.stringify({ songId, slots }),
  });
}

// ── Overflow duplicates ───────────────────────────────────────────────────────

export function convertOverflow(duplicateId, convertTo = 'currency') {
  return apiFetch(`/api/card-game/overflow/${duplicateId}/convert`, {
    method: 'POST',
    body: JSON.stringify({ convertTo }),
  });
}

// ── Shows & leaderboard ──────────────────────────────────────────────────────

export function getTodayShows() {
  return apiFetch('/api/card-game/shows/today');
}

export function getLeaderboard(showId) {
  return apiFetch(`/api/card-game/leaderboard/${showId}`);
}

export function getLeaderboardHistory(genderCategory, limit = 20, offset = 0) {
  return apiFetch(
    `/api/card-game/leaderboard/history?genderCategory=${genderCategory}&limit=${limit}&offset=${offset}`
  );
}
