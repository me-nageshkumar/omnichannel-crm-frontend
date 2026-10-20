import { screen, within } from '@testing-library/react';
import type { UserSummary } from '@app/api/users';
import type { renderApp } from './renderApp';

type User = ReturnType<typeof renderApp>['user'];

export function summary(over: Partial<UserSummary> & Pick<UserSummary, 'id' | 'name' | 'username'>): UserSummary {
  return {
    email: null,
    mobileNumber: null,
    active: true,
    disabled: null,
    role: null,
    workspaceRoles: [],
    mustChangePassword: false,
    ...over,
  };
}

/** The table row containing {@code text}. */
export async function rowWith(text: string): Promise<HTMLElement> {
  const cell = await screen.findByText(text);
  const row = cell.closest('tr');
  if (!row) throw new Error(`no row for ${text}`);
  return row;
}

/** Opens the row's kebab and picks {@code action}. */
export async function rowAction(user: User, text: string, action: string): Promise<void> {
  const row = await rowWith(text);
  await user.click(within(row).getByRole('button', { name: 'Kebab toggle' }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

/** Fills a labelled input (label matched by prefix, since required labels end in " *"). */
export async function fill(user: User, label: string, value: string): Promise<void> {
  const input = await screen.findByLabelText(new RegExp(`^${label}`));
  await user.clear(input);
  if (value) await user.type(input, value);
}

/** Every URL (path and query) a mocked fetch was called with for "METHOD /path". */
export function urlsOf(fn: { mock: { calls: unknown[][] } }, key: string): string[] {
  const [method, path] = key.split(' ');
  return fn.mock.calls
    .map(([input, init]) => ({
      url: typeof input === 'string' ? input : String(input),
      method: ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase(),
    }))
    .filter((c) => c.method === method && new URL(c.url, 'http://localhost').pathname === path)
    .map((c) => c.url);
}
