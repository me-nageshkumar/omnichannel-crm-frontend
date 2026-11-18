import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { rowAction, rowWith } from '../../test/admin';
import { phoneNumber } from '../../test/phoneNumbers';

const MAIN = phoneNumber({
  id: 'n1',
  number: '919928088743',
  label: 'Main line',
  status: 'CONNECTED',
  workspaceName: 'Demo Fashion',
});
const ARCHIVE = phoneNumber({
  id: 'n2',
  number: '919928088744',
  label: 'Old line (until 2 Nov)',
  status: 'ARCHIVED',
  archiveOf: 'n0',
  archivedAt: '2026-11-02T10:00:00Z',
  disabled: { by: 'Archived', level: 'PLATFORM', at: '2026-11-02T10:00:00Z' },
  disabledBecause: 'NUMBER',
});
const page = (items: unknown[]) => ({ status: 200, body: { items, total: items.length, page: 0 } });
const CUSTOMER = {
  status: 200,
  body: {
    customer: {
      id: 'c1',
      name: 'Acme',
      active: true,
      disabled: null,
      creationTime: '',
      planName: null,
      subscriptionState: 'ACTIVE',
    },
    workspaces: [
      { id: 'w1', name: 'Demo Fashion', disabled: null },
      { id: 'w9', name: 'Bimal Institute', disabled: null },
      { id: 'w5', name: 'Closed brand', disabled: { by: 'x', level: 'PLATFORM', at: '2026-10-01T00:00:00Z' } },
    ],
    admins: [],
  },
};
const PREVIEW = {
  fromWorkspaceName: 'Demo Fashion',
  toWorkspaceName: 'Bimal Institute',
  chats: 75,
  activeRuns: 2,
  teamName: 'Sales',
  archiveLabel: 'Main line (until 18 Nov)',
  movingBack: false,
  returningChats: 0,
  rulesNamingNumber: [],
  activeCampaigns: [],
};
const MOVE = {
  id: 'm1',
  phoneNumberId: 'n1',
  fromWorkspaceId: 'w1',
  fromWorkspaceName: 'Demo Fashion',
  toWorkspaceId: 'w9',
  toWorkspaceName: 'Bimal Institute',
  step: 'DONE',
  done: true,
  error: null,
  counts: { chats: 75, messages: 567, runsEnded: 2 },
  startedAt: '2026-11-18T10:00:00Z',
  finishedAt: '2026-11-18T10:00:02Z',
};

function open(extra = {}, items: unknown[] = [MAIN]) {
  const fetch = mockFetch({
    ...meAs(SUPER_ADMIN),
    'GET /api/phone-numbers': page(items),
    'GET /api/customers/c1': CUSTOMER,
    ...extra,
  });
  const rendered = renderApp('/platform/phone-numbers');
  return { fetch, ...rendered };
}

describe('move a number to another brand', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('moveShowsPreviewAndMoves', async () => {
    let listed: unknown[] = [MAIN];
    const { fetch, user } = open({
      'GET /api/phone-numbers': () => page(listed),
      'GET /api/phone-numbers/n1/move/preview': { status: 200, body: PREVIEW },
      'POST /api/phone-numbers/n1/move': () => {
        listed = [{ ...MAIN, workspaceId: 'w9', workspaceName: 'Bimal Institute' }];
        return { status: 200, body: MOVE };
      },
    });
    await rowAction(user, '+919928088743', 'Move to brand…');
    const dialog = await screen.findByRole('dialog', { name: /Move Main line/ });
    const select = within(dialog).getByLabelText('To brand');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a brand', 'Bimal Institute']);

    await user.selectOptions(select, 'w9');
    expect(
      await within(dialog).findByText('Its 75 chats stay in Demo Fashion as "Main line (until 18 Nov)", read only.'),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/2 unfinished chatbot runs on this number end\. Its team \(Sales\) is cleared/),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));

    expect(await within(await rowWith('+919928088743')).findByText('Bimal Institute')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/phone-numbers/n1/move')?.body).toEqual({ workspaceId: 'w9' });
  });

  it('movingBackWording', async () => {
    const { user } = open({
      'GET /api/phone-numbers/n1/move/preview': {
        status: 200,
        body: { ...PREVIEW, movingBack: true, returningChats: 75, chats: 3, archiveLabel: 'Main line (until 25 Nov)' },
      },
    });
    await rowAction(user, '+919928088743', 'Move to brand…');
    const dialog = await screen.findByRole('dialog', { name: /Move Main line/ });
    await user.selectOptions(within(dialog).getByLabelText('To brand'), 'w9');
    expect(
      await within(dialog).findByText('The 75 archived chats in Bimal Institute return to Main line.'),
    ).toBeVisible();
    expect(
      within(dialog).getByText('Its 3 chats stay in Demo Fashion as "Main line (until 25 Nov)", read only.'),
    ).toBeVisible();
  });

  it('rulesNamingNumberWarnedAndActiveCampaignsBlock', async () => {
    const { user, fetch } = open({
      'GET /api/phone-numbers/n1/move/preview': {
        status: 200,
        body: { ...PREVIEW, rulesNamingNumber: ['Walk: chatbot first'], activeCampaigns: ['Diwali offer'] },
      },
    });
    await rowAction(user, '+919928088743', 'Move to brand…');
    const dialog = await screen.findByRole('dialog', { name: /Move Main line/ });
    await user.selectOptions(within(dialog).getByLabelText('To brand'), 'w9');

    expect(
      await within(dialog).findByText('Rules in Demo Fashion that name this number: Walk: chatbot first'),
    ).toBeVisible();
    expect(within(dialog).getByText('Stop these campaigns first: Diwali offer')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Move' })).toBeDisabled();
    expect(callsTo(fetch, 'POST /api/phone-numbers/n1/move')).toBe(0);
  });

  it('unfinishedMoveShowsRetryAndCancel', async () => {
    let listed: unknown[] = [{ ...MAIN, moveUnfinished: true }];
    const { user, fetch } = open({
      'GET /api/phone-numbers': () => page(listed),
      'POST /api/phone-numbers/n1/move/retry': () => {
        listed = [MAIN];
        return { status: 200, body: MOVE };
      },
      'POST /api/phone-numbers/n1/move/cancel': {
        status: 409,
        body: { error: 'number_move_too_far', message: 'Retry to finish this move' },
      },
    });
    const row = await rowWith('+919928088743');
    expect(within(row).getByText('Move did not finish')).toBeVisible();

    await rowAction(user, '+919928088743', 'Cancel move');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel move' }));
    expect(await within(dialog).findByText('Retry to finish this move')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await rowAction(user, '+919928088743', 'Retry move');
    await waitFor(() => expect(callsTo(fetch, 'POST /api/phone-numbers/n1/move/retry')).toBe(1));
    await waitFor(() =>
      expect(within(screen.getByRole('row', { name: /919928088743/ })).queryByText('Move did not finish')).toBeNull(),
    );
  });

  it('noMoveForArchivesOrWithoutManageAll', async () => {
    const { user } = open({}, [ARCHIVE]);
    const row = await rowWith('+919928088744');
    expect(within(row).getByText('Archived')).toBeVisible();
    await user.click(within(row).getByRole('button', { name: 'Kebab toggle' }));
    expect(screen.queryByRole('menuitem', { name: 'Move to brand…' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Enable' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });

  it('viewOnlyHasNoMove', async () => {
    mockFetch({
      ...meAs({ ...ACCOUNT_MANAGER, authorities: ['customer:view', 'phone-number:view-all'] }),
      'GET /api/phone-numbers': page([MAIN]),
    });
    renderApp('/platform/phone-numbers');
    const row = await rowWith('+919928088743');
    expect(within(row).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });
});
