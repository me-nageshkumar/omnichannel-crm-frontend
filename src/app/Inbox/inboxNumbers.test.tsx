import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { InboxSettings } from '@app/api/inbox';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { rowWith } from '../../test/admin';
import { phoneNumber } from '../../test/phoneNumbers';
import { AGENT_IN_BRAND, BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import type { CurrentUser } from '@app/api/users';

const B = '/api/workspaces/w1';
const WEB = phoneNumber({ id: 'p1', number: '919928088743', label: 'Sales', status: 'CONNECTED' });
const CLOUD = phoneNumber({ id: 'p2', number: '919811100000', label: 'Support', connectionType: 'WHATSAPP_CLOUD_API' });
const SETTINGS: InboxSettings = {
  mode: 'NONE',
  teamId: null,
  userId: null,
  claimOnReply: false,
  keepAssignmentOnClose: false,
};
const TEAMS = [
  { id: 't1', name: 'Support team', members: [] },
  { id: 't2', name: 'Sales team', members: [] },
];

/** An agent in Brand A who may open the inbox but not change its routing. */
const AGENT_WITH_INBOX: CurrentUser = {
  ...AGENT_IN_BRAND,
  workspaces: [{ ...BRAND_A, authorities: ['inbox:view'] }],
};

function routes(extra = {}, user = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [`GET ${B}/inbox/phone-numbers`]: { status: 200, body: [WEB, CLOUD] },
    [`GET ${B}/inbox/phone-numbers/p1/settings`]: { status: 200, body: SETTINGS },
    [`GET ${B}/teams`]: { status: 200, body: TEAMS },
    [`GET ${B}/users`]: { status: 200, body: [{ id: 'u9', name: 'Asha Agent', username: 'asha' }] },
    ...extra,
  };
}

describe('inbox number picker', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists numbers and links WhatsApp Web ones', async () => {
    mockFetch(routes());
    renderApp('/inbox');
    const row = await rowWith('Sales');
    expect(within(row).getByRole('link', { name: '+919928088743' })).toHaveAttribute('href', '/inbox/p1');
    expect(within(row).getByText('Connected')).toBeVisible();
  });

  it('cloud api numbers are disabled with the coming-later text', async () => {
    mockFetch(routes());
    renderApp('/inbox');
    const row = await rowWith('Support');
    expect(within(row).getByText('Cloud API inbox coming later')).toBeVisible();
    expect(within(row).queryByRole('link')).toBeNull();
    expect(within(row).getByText('+919811100000')).toBeVisible();
  });

  it('shows the empty state with a link to the phone numbers', async () => {
    mockFetch(routes({ [`GET ${B}/inbox/phone-numbers`]: { status: 200, body: [] } }));
    renderApp('/inbox');
    expect(await screen.findByText('No WhatsApp numbers yet')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to phone numbers' })).toHaveAttribute('href', '/phone-numbers');
  });

  it('routing button hidden without inbox:settings', async () => {
    mockFetch(routes({}, AGENT_WITH_INBOX));
    renderApp('/inbox');
    await rowWith('Sales');
    expect(screen.queryByRole('button', { name: 'Routing' })).toBeNull();
  });

  it('routing modal saves mode and team', async () => {
    const fetch = mockFetch(
      routes({
        [`PUT ${B}/inbox/phone-numbers/p1/settings`]: (req: { body: InboxSettings }) => ({
          status: 200,
          body: req.body,
        }),
      }),
    );
    const { user } = renderApp('/inbox');
    const row = await rowWith('Sales');
    await user.click(within(row).getByRole('button', { name: 'Routing' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Routing')).toBeEnabled());
    expect(within(dialog).queryByLabelText(/^Team/)).toBeNull();
    await user.selectOptions(within(dialog).getByLabelText('Routing'), 'Team queue');
    await user.selectOptions(await within(dialog).findByLabelText(/^Team/), 'Support team');
    await user.click(within(dialog).getByRole('switch', { name: 'Assign the chat to whoever replies first' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(fetch, `PUT ${B}/inbox/phone-numbers/p1/settings`)?.body).toEqual({
      mode: 'TEAM',
      teamId: 't1',
      userId: null,
      claimOnReply: true,
      keepAssignmentOnClose: false,
    });
  });

  it('routing modal shows the agent field for one agent and field errors from the server', async () => {
    mockFetch(
      routes({
        [`PUT ${B}/inbox/phone-numbers/p1/settings`]: {
          status: 400,
          body: { code: 'VALIDATION', message: 'Invalid', fields: { userId: 'Pick an agent in this brand.' } },
        },
      }),
    );
    const { user } = renderApp('/inbox');
    const row = await rowWith('Sales');
    await user.click(within(row).getByRole('button', { name: 'Routing' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Routing')).toBeEnabled());
    await user.selectOptions(within(dialog).getByLabelText('Routing'), 'One agent');
    expect(within(dialog).queryByLabelText(/^Team/)).toBeNull();
    expect(within(dialog).getByLabelText(/^Agent/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Pick an agent in this brand.')).toBeVisible();
  });
});

describe('inbox navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('nav shows Inbox only with inbox:view', async () => {
    mockFetch(routes());
    const first = renderApp('/');
    expect(await screen.findByRole('link', { name: 'Inbox', hidden: true })).toBeInTheDocument();
    first.unmount();
    vi.unstubAllGlobals();

    mockFetch(routes({}, AGENT_IN_BRAND));
    renderApp('/');
    await screen.findByRole('link', { name: 'Dashboard', hidden: true });
    expect(screen.queryByRole('link', { name: 'Inbox', hidden: true })).toBeNull();
  });

  it('the chat routes open the inbox page', async () => {
    mockFetch(routes());
    renderApp('/inbox/p1/c1');
    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeVisible();
  });
});
