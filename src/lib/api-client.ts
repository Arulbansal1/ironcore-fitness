'use client';

/** Error thrown by the browser-side API helper, carrying the server's message. */
export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Thin fetch wrapper: always sends/receives JSON, converts non-2xx responses
 * into a typed error carrying the server's human-readable message.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError(0, 'Could not reach the server. Check your connection and try again.', 'network_error');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const data = payload as { error?: string; code?: string; details?: unknown } | null;
    throw new ApiClientError(
      response.status,
      data?.error ?? `Request failed (${response.status}).`,
      data?.code ?? 'error',
      data?.details,
    );
  }

  return payload as T;
}

/** Multipart upload helper used by the attachment picker. */
export async function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', body: formData, credentials: 'same-origin' });
  } catch {
    throw new ApiClientError(0, 'Upload failed — could not reach the server.', 'network_error');
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      (payload?.error as string) ?? `Upload failed (${response.status}).`,
      (payload?.code as string) ?? 'error',
    );
  }
  return payload as T;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
