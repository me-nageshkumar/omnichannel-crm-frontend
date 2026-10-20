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
    /** The server's own sentence, for errors whose wording only the server knows. */
    public readonly serverMessage?: string,
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

/** Tells the app the session is no longer valid, for callers that see the 401 themselves (the event stream). */
export function signalUnauthorized(): void {
  onUnauthorized?.();
}

/** Turns a non-2xx reply into the {@link ApiError} callers handle; also signals an expired session. */
function failure(res: Response, path: string, text: string): ApiError {
  let data: Record<string, unknown> | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (res.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized?.();
  const code = (data?.error ?? data?.code) as string | undefined;
  const retry = typeof data?.retryAfterSeconds === 'number' ? data.retryAfterSeconds : undefined;
  const field = typeof data?.field === 'string' ? data.field : undefined;
  const fields = data?.fields && typeof data.fields === 'object' ? (data.fields as Record<string, string>) : undefined;
  const roles = Array.isArray(data?.roles) ? (data.roles as string[]) : undefined;
  const serverMessage = typeof data?.message === 'string' ? data.message : undefined;
  return new ApiError(res.status, code, retry, field, fields, roles, serverMessage);
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
  if (!res.ok) throw failure(res, path, text);
  let data: Record<string, unknown> | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  return data as T;
}

/**
 * A POST whose request or reply is not JSON (a file upload, a file download). {@code body} is sent as is,
 * so a FormData gets its multipart boundary from the browser. Non-2xx replies throw like {@link apiFetch}.
 */
export async function apiFetchFile(
  path: string,
  init: { token?: string | null; body?: unknown; json?: boolean },
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.json) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: init.json ? JSON.stringify(init.body) : (init.body as BodyInit),
  });
  if (!res.ok) throw failure(res, path, await res.text());
  return res;
}

/** A GET whose reply is a file (template media), which needs the auth header and so cannot be a plain `src`. */
export async function apiFetchBlob(path: string, token: string): Promise<Blob> {
  const res = await fetch(path, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw failure(res, path, await res.text());
  return res.blob();
}
