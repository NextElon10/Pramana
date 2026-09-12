const BASE = '/api';

export const NOT_AVAILABLE = 'Not provided in source data';

export class ApiError extends Error {
  status: number;
  code: string;
  /** The parsed error payload, so callers can read structured extras (e.g. a fresh captcha). */
  body: any;
  constructor(status: number, code: string, message: string, body: any = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function request(path: string, opts: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the PRAMANA backend. Make sure it is running on port 4000 (cd backend && npm run dev).');
  }
  if (!res.ok) {
    let body: any = {};
    try { body = await res.json(); } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, body.error || 'ERROR', body.message || `Request failed (${res.status})`, body);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: any) => request(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
  upload: async (path: string, formData: FormData) => {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', body: formData });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the PRAMANA backend. Make sure it is running on port 4000.');
    }
    if (!res.ok) {
      let body: any = {};
      try { body = await res.json(); } catch { /* non-JSON error body */ }
      throw new ApiError(res.status, body.error || 'ERROR', body.message || `Request failed (${res.status})`, body);
    }
    return res.json();
  },
};

/** Full rupee value with Indian digit grouping, e.g. ₹19,60,63,957 */
export function formatINR(amount: number | null | undefined) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return NOT_AVAILABLE;
  return `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;
}

/** Compact Indian scale, e.g. ₹19.61 Cr / ₹4.90 L — far more readable in tables and tiles. */
export function formatCompactINR(amount: number | null | undefined) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  const abs = Math.abs(n);
  const group = (v: number, dp: number) => v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  if (abs >= 1e7) return `₹${group(n / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `₹${group(n / 1e5, 2)} L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)} K`;
  return `₹${Math.round(n)}`;
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-IN');
}
