const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

let csrfToken: string | null = null;

export const getApiBaseUrl = () => API_BASE_URL;

async function bootstrapCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, { credentials: 'include' });
  if (!response.ok) throw new ApiError('CSRF_BOOTSTRAP_FAILED', 'Unable to initialize a secure session.', response.status);
  const payload = await response.json() as { csrfToken: string };
  csrfToken = payload.csrfToken;
  return csrfToken;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (unsafeMethod) headers.set('x-csrf-token', csrfToken || await bootstrapCsrfToken());

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as T | { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(error?.code || 'REQUEST_FAILED', error?.message || 'The request could not be completed.', response.status);
  }
  const newCsrfToken = (payload as { csrfToken?: string } | null)?.csrfToken;
  if (newCsrfToken) csrfToken = newCsrfToken;
  return payload as T;
}

export async function endSession() {
  try { await apiRequest('/api/auth/logout', { method: 'POST' }); }
  finally { csrfToken = null; }
}
