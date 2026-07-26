/**
 * Kotak Neo Trade API utility module.
 *
 * All functions pass the X-Session-Id from sessionStorage
 * to authenticate against the BFF proxy at /api/kotak-neo/*.
 */

const KOTAK_API_BASE = 'http://localhost:4000/api/kotak-neo';
const SESSION_KEY = 'kotak-neo-session-id';

function getHeaders(): HeadersInit {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }
  return headers;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const kotakApi = {
  /**
   * Get the stored session ID from sessionStorage.
   */
  getSessionId(): string | null {
    return sessionStorage.getItem(SESSION_KEY);
  },

  /**
   * Store a session ID in sessionStorage.
   */
  setSessionId(sessionId: string): void {
    sessionStorage.setItem(SESSION_KEY, sessionId);
  },

  /**
   * Clear the stored session ID.
   */
  clearSessionId(): void {
    sessionStorage.removeItem(SESSION_KEY);
  },

  /**
   * Step 1: TOTP Login
   */
  async loginTotp(mobileNumber: string, ucc: string, totp: string) {
    const res = await fetch(`${KOTAK_API_BASE}/login/totp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber, ucc, totp }),
    });
    return handleResponse(res);
  },

  /**
   * Step 2: MPIN Validate → returns { sessionId, baseUrl, greetingName }
   */
  async loginMpin(mpin: string) {
    const res = await fetch(`${KOTAK_API_BASE}/login/mpin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mpin }),
    });
    return handleResponse(res);
  },

  /**
   * GET /api/kotak-neo/status
   */
  async getStatus() {
    const res = await fetch(`${KOTAK_API_BASE}/status`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  /**
   * GET /api/kotak-neo/reports/holdings
   */
  async getHoldings() {
    const res = await fetch(`${KOTAK_API_BASE}/reports/holdings`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  /**
   * GET /api/kotak-neo/reports/positions
   */
  async getPositions() {
    const res = await fetch(`${KOTAK_API_BASE}/reports/positions`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  /**
   * GET /api/kotak-neo/reports/orders
   */
  async getOrders() {
    const res = await fetch(`${KOTAK_API_BASE}/reports/orders`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  /**
   * GET /api/kotak-neo/reports/trades
   */
  async getTrades() {
    const res = await fetch(`${KOTAK_API_BASE}/reports/trades`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  /**
   * POST /api/kotak-neo/orders/place
   */
  async placeOrder(jData: object) {
    const res = await fetch(`${KOTAK_API_BASE}/orders/place`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ jData }),
    });
    return handleResponse(res);
  },

  /**
   * POST /api/kotak-neo/orders/modify
   */
  async modifyOrder(jData: object) {
    const res = await fetch(`${KOTAK_API_BASE}/orders/modify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ jData }),
    });
    return handleResponse(res);
  },

  /**
   * POST /api/kotak-neo/orders/cancel
   */
  async cancelOrder(jData: object) {
    const res = await fetch(`${KOTAK_API_BASE}/orders/cancel`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ jData }),
    });
    return handleResponse(res);
  },

  /**
   * GET /api/kotak-neo/quotes?exchangeSegment=&symbol=
   */
  async getQuotes(exchangeSegment: string, symbol: string) {
    const params = new URLSearchParams({ exchangeSegment, symbol });
    const res = await fetch(`${KOTAK_API_BASE}/quotes?${params.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  /**
   * POST /api/kotak-neo/funds/limits
   */
  async getLimits() {
    const res = await fetch(`${KOTAK_API_BASE}/funds/limits`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ jData: { seg: 'ALL', exch: 'ALL', prod: 'ALL' } }),
    });
    return handleResponse(res);
  },

  /**
   * POST /api/kotak-neo/funds/margins
   */
  async getMargins(jData: object) {
    const res = await fetch(`${KOTAK_API_BASE}/funds/margins`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ jData }),
    });
    return handleResponse(res);
  },

  /**
   * GET /api/kotak-neo/logout
   */
  async logout() {
    const res = await fetch(`${KOTAK_API_BASE}/logout`, {
      headers: getHeaders(),
    });
    kotakApi.clearSessionId();
    return handleResponse(res);
  },
};
