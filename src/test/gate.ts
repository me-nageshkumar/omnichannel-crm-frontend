import type { mockFetch } from './fetchMock';

type MockedFetch = ReturnType<typeof mockFetch>;

/**
 * Holds the {@code nth} (1-based) request to "METHOD /path" until {@code release()}. The route still
 * answers when the request is made (so a counting route numbers its answers in call order); only
 * the delivery of that answer waits. Other requests pass straight through.
 */
export function gate(fetch: MockedFetch, key: string, nth: number): { release(): void } {
  const [method, path] = key.split(' ');
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const answer = fetch.getMockImplementation() as NonNullable<ReturnType<MockedFetch['getMockImplementation']>>;
  let seen = 0;
  fetch.mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const matches =
      (init?.method ?? 'GET').toUpperCase() === method && new URL(url, 'http://localhost').pathname === path;
    const response = answer(input, init);
    if (matches && ++seen === nth) await held;
    return response;
  });
  return { release: () => release() };
}
