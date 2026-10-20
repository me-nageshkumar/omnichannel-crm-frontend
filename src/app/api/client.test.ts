import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiFetchBlob, setUnauthorizedHandler, signalUnauthorized } from '@app/api/client';
import { mockFetch, rejectionOf, requestTo } from '../../test/fetchMock';

describe('apiFetch', () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('signalUnauthorized calls the registered handler, and does nothing without one', () => {
    expect(() => signalUnauthorized()).not.toThrow();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    signalUnauthorized();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('adds the bearer token', async () => {
    const fetch = mockFetch({ 'GET /api/users/me': { status: 200, body: { ok: true } } });
    await apiFetch('/api/users/me', { token: 't' });
    expect(requestTo(fetch, 'GET /api/users/me')?.headers.get('Authorization')).toBe('Bearer t');
  });

  it('sends a JSON body', async () => {
    const fetch = mockFetch({ 'POST /api/x': { status: 200, body: {} } });
    await apiFetch('/api/x', { method: 'POST', body: { a: 1 } });
    const req = requestTo(fetch, 'POST /api/x');
    expect(req?.headers.get('Content-Type')).toBe('application/json');
    expect(req?.body).toEqual({ a: 1 });
  });

  it('resolves undefined on 204', async () => {
    mockFetch({ 'POST /api/x': { status: 204 } });
    await expect(apiFetch('/api/x', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('throws ApiError with the code', async () => {
    mockFetch({ 'POST /api/x': { status: 400, body: { code: 'INVALID_OTP', message: 'no' } } });
    const err = await rejectionOf<ApiError>(apiFetch('/api/x', { method: 'POST' }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('INVALID_OTP');
  });

  it('calls the unauthorized handler once on a 401 outside /api/auth', async () => {
    mockFetch({ 'GET /api/users/me': { status: 401 } });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const err = await rejectionOf<ApiError>(apiFetch('/api/users/me', { token: 't' }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });

  it('does not call the unauthorized handler for /api/auth', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 401, body: { error: 'invalid_credentials' } } });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const err = await rejectionOf<ApiError>(apiFetch('/api/auth/login', { method: 'POST', body: {} }));
    expect(handler).not.toHaveBeenCalled();
    expect(err.code).toBe('invalid_credentials');
  });
});

describe('apiFetchBlob', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('GETs the bytes with the bearer token', async () => {
    const fetch = mockFetch({
      'GET /api/file': { status: 200, text: 'PNGDATA', headers: { 'Content-Type': 'image/png' } },
    });
    const blob = await apiFetchBlob('/api/file', 't');
    expect(blob.size).toBe(7);
    expect(blob.type).toBe('image/png');
    expect(requestTo(fetch, 'GET /api/file')?.headers.get('Authorization')).toBe('Bearer t');
  });

  it('throws ApiError on a non-2xx reply', async () => {
    mockFetch({ 'GET /api/file': { status: 404, body: { code: 'NOT_FOUND' } } });
    const err = await rejectionOf<ApiError>(apiFetchBlob('/api/file', 't'));
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});
