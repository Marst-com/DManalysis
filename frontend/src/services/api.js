/**
 * API abstraction layer.
 * All backend requests go through here.
 * Frontend never accesses DB directly.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Token storage: use memory for access token (not localStorage)
// to reduce XSS risk. Refresh token handled via httpOnly cookie (server-side).
let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

async function request(method, path, body = null, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const config = {
    method,
    headers,
    credentials: 'include', // send httpOnly cookies (refresh token)
  };

  if (body !== null) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, config);

  // Handle 401: token expired
  if (response.status === 401 && !options._retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request(method, path, body, { ...options, _retry: true });
    }
    // Refresh failed: clear session
    clearAccessToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { message: await response.text() };
  }

  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'Request failed.');
  }

  return data;
}

async function tryRefreshToken() {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// HTTP method shortcuts
export const api = {
  get: (path, opts) => request('GET', path, null, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
  put: (path, body, opts) => request('PUT', path, body, opts),
  delete: (path, opts) => request('DELETE', path, null, opts),
};

export default api;
