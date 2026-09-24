import { API_URL } from '@/config/api';
import { syncServerTime } from '@/lib/serverClock';

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Set by the AuthProvider; read on every request.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

export async function handleErrorResponse(status: number, payload: unknown): Promise<never> {
  const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  if (status === 401 && (err?.code === 'INVALID_TOKEN' || err?.code === 'UNAUTHENTICATED')) onUnauthorized?.();
  const details = Array.isArray(err?.details) ? (err.details as FieldIssue[]) : [];
  throw new ApiError(status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Request failed (${status})`, details);
}

export async function api<T>(path: string, { method = 'GET', body, query, signal }: RequestOptions = {}): Promise<T> {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}${qs}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }

  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) return handleErrorResponse(res.status, payload);
  if (payload && typeof payload.serverTime === 'string') syncServerTime(payload.serverTime, startedAt);
  return payload as T;
}
