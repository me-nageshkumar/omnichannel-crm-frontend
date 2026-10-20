/** A non-2xx reply. {@code code} is the body's {@code error} (auth endpoints) or {@code code} (everything else). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly retryAfterSeconds?: number,
    /** The field a DUPLICATE refers to. */
    public readonly field?: string,
    /** Per-field messages of a VALIDATION error. */
    public readonly fields?: Record<string, string>,
    /** The roles holding an authority, on AUTHORITY_IN_USE. */
    public readonly roles?: string[],
  ) {
    super(code ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

interface ApiFetchInit {
  method?: string;
  body?: unknown;
  token?: string | null;
}

let onUnauthorized: (() => void) | null = null;

/** Called on a 401 from any endpoint outside /api/auth, i.e. when the session itself is no longer valid. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = res.status === 204 ? '' : await res.text();
  let data: Record<string, unknown> | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized?.();
    const code = (data?.error ?? data?.code) as string | undefined;
    const retry = typeof data?.retryAfterSeconds === 'number' ? data.retryAfterSeconds : undefined;
    const field = typeof data?.field === 'string' ? data.field : undefined;
    const fields =
      data?.fields && typeof data.fields === 'object' ? (data.fields as Record<string, string>) : undefined;
    const roles = Array.isArray(data?.roles) ? (data.roles as string[]) : undefined;
    throw new ApiError(res.status, code, retry, field, fields, roles);
  }
  return data as T;
}
