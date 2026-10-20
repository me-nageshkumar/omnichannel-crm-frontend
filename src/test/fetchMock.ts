import { vi } from 'vitest';

export interface MockRequest {
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  headers: Headers;
}

export interface MockResponse {
  status: number;
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as is (e.g. a CSV file); use {@code headers} for its Content-Type. */
  text?: string;
  headers?: Record<string, string>;
}

export type MockRoute = MockResponse | ((req: MockRequest) => MockResponse);

/**
 * Replaces global fetch. Routes are keyed "METHOD /path"; a function route sees the parsed JSON
 * body and the headers. An unmatched request fails the test.
 */
export function mockFetch(routes: Record<string, MockRoute>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = `${method} ${new URL(url, 'http://localhost').pathname}`;
    const route = routes[key];
    if (!route) {
      throw new Error(`unexpected request: ${key}`);
    }
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' && init.body.length > 0 ? JSON.parse(init.body) : undefined;
    const res = typeof route === 'function' ? route({ body, headers }) : route;
    const text = res.text ?? (res.body === undefined ? '' : JSON.stringify(res.body));
    return new Response(res.status === 204 ? null : text, {
      status: res.status,
      headers: { ...(text && res.text === undefined ? { 'Content-Type': 'application/json' } : {}), ...res.headers },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** The request a mocked fetch received for "METHOD /path" (the n-th, default first). */
export function requestTo(fn: ReturnType<typeof mockFetch>, key: string, n = 0) {
  const [method, path] = key.split(' ');
  const calls = fn.mock.calls.filter(([input, init]) => {
    const url = typeof input === 'string' ? input : input.toString();
    return (init?.method ?? 'GET').toUpperCase() === method && new URL(url, 'http://localhost').pathname === path;
  });
  const call = calls[n];
  if (!call) return undefined;
  const init = call[1];
  return {
    headers: new Headers(init?.headers),
    body: typeof init?.body === 'string' && init.body ? JSON.parse(init.body) : undefined,
  };
}

export function callsTo(fn: ReturnType<typeof mockFetch>, key: string): number {
  let n = 0;
  while (requestTo(fn, key, n)) n++;
  return n;
}

/** The error a promise rejects with; fails the test if it resolves. */
export async function rejectionOf<E = Error>(promise: Promise<unknown>): Promise<E> {
  try {
    await promise;
  } catch (e) {
    return e as E;
  }
  throw new Error('expected the promise to reject');
}
