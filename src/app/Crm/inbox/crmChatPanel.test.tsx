import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { ChatView, ThreadItem } from '@app/api/inbox';
import type { InboxSummary } from '@app/api/crm';
import type { CurrentUser } from '@app/api/users';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, crmStatus, sampleCrmContact, sampleDeal, samplePipeline, sampleTask } from '../../../test/crm';
import { gate } from '../../../test/gate';
import { streamMock } from '../../../test/inbox';
import { phoneNumber } from '../../../test/phoneNumbers';
import { renderApp } from '../../../test/renderApp';
import { useLocation } from 'react-router-dom';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';

const Search = () => <output aria-label="Query string">{useLocation().search}</output>;
const B = '/api/workspaces/w1';
const SUMMARY1 = `GET ${B}/crm/contacts/by-chat/c1/summary`;
const SUMMARY2 = `GET ${B}/crm/contacts/by-chat/c2/summary`;
const CAPTURE = `POST ${B}/crm/contacts/capture`;
const PIPELINES = `GET ${B}/crm/pipelines`;
const SETTINGS = `GET ${B}/crm/settings`;
const STATUS = `GET ${B}/crm/status`;
const UPDATE = `PUT ${B}/crm/contacts/k1`;

const NUMBER = phoneNumber({ id: 'p1', number: '919928088743', label: 'Sales', status: 'CONNECTED' });
const ASHA: ChatView = {
  id: 'c1',
  phoneNumberId: 'p1',
  remoteId: '919900000001@c.us',
  contact: { id: 'ct1', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
  status: 'OPEN',
  assignedUser: null,
  assignedTeam: null,
  unreadCount: 0,
  lastMessageAt: new Date(Date.now() - 3600_000).toISOString(),
  lastMessage: { direction: 'IN', type: 'text', text: 'Hello from Asha', status: 'READ' },
  creationTime: '2026-10-20T10:00:00Z',
  lastAgent: null,
};
const MEENA: ChatView = { ...ASHA, id: 'c2', contact: { id: 'ct2', name: 'Meena', phone: '919900000002', numberHidden: false } };

const summary = (over: Partial<InboxSummary> = {}): InboxSummary => ({
  chatId: 'c1',
  canCapture: true,
  captureBlockedReason: null,
  contact: null,
  openDeals: [],
  nextTask: null,
  ...over,
});
const captured = (name: string, chatId = 'c1'): InboxSummary =>
  summary({
    chatId,
    canCapture: false,
    contact: sampleCrmContact({ id: 'k1', name, lifecycleStatus: 'lead', version: 5 }),
    openDeals: [sampleDeal({ id: 'd1', title: 'Acme order', amount: 1500, currency: 'INR' })],
  });

const LIFECYCLES = [
  { key: 'lead', label: 'Lead', color: '#4394e5', position: 1000, active: true, isDefault: true },
  { key: 'customer', label: 'Customer', color: '#87bb62', position: 2000, active: true, isDefault: false },
];

function routes(extra: Record<string, unknown> = {}, user: CurrentUser = WORKSPACE_MANAGER) {
  const stream = streamMock();
  return {
    ...meAs(user),
    [`GET ${B}/inbox/phone-numbers`]: { status: 200, body: [NUMBER] },
    [`GET ${B}/inbox/chats`]: { status: 200, body: { items: [ASHA, MEENA], hasMore: false } },
    [`GET ${B}/inbox/chats/c1`]: { status: 200, body: ASHA },
    [`GET ${B}/inbox/chats/c2`]: { status: 200, body: MEENA },
    [`GET ${B}/inbox/chats/c1/thread`]: { status: 200, body: { items: [] as ThreadItem[], hasMore: false } },
    [`GET ${B}/inbox/chats/c2/thread`]: { status: 200, body: { items: [] as ThreadItem[], hasMore: false } },
    [`POST ${B}/inbox/chats/c1/read`]: { status: 204 },
    [`POST ${B}/inbox/chats/c2/read`]: { status: 204 },
    [`GET ${B}/inbox/stream`]: stream.response,
    [STATUS]: { status: 200, body: crmStatus() },
    [SETTINGS]: { status: 200, body: crmSettings({ lifecycleStatuses: LIFECYCLES }) },
    [PIPELINES]: { status: 200, body: [samplePipeline()] },
    ...extra,
  } as Parameters<typeof mockFetch>[0];
}

describe('CRM chat panel', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('noPanelAndNoRequestWhenCrmOff', async () => {
    const f = mockFetch(routes({ [STATUS]: { status: 200, body: crmStatus({ enabled: false }) } }));
    renderApp('/inbox/chats/c1');
    await screen.findByRole('group', { name: 'Chat header' });
    await waitFor(() => expect(callsTo(f, STATUS)).toBe(1));
    expect(screen.queryByRole('complementary', { name: 'CRM' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'CRM panel' })).toBeNull();
    const crm = f.mock.calls.filter(([url]) => String(url).includes('/crm/'));
    expect(crm).toHaveLength(1);
  });

  it('captureWithSinglePipelineSkipsPicker', async () => {
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: summary() },
        [CAPTURE]: { status: 200, body: { contact: captured('Asha Rao').contact, deal: sampleDeal(), createdContact: true, createdDeal: true } },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    await user.click(await screen.findByRole('button', { name: 'Capture to CRM' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByLabelText('Deal title (optional)')).toBeVisible();
    expect(within(dialog).queryByLabelText('Pipeline')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Capture' }));
    expect(await screen.findByRole('link', { name: 'Asha Rao' })).toHaveAttribute('href', '/crm/contacts/k1');
    expect(requestTo(f, CAPTURE)?.body).toEqual({ chatId: 'c1', pipelineId: 'p1' });
    expect(screen.queryByRole('button', { name: 'Capture to CRM' })).toBeNull();
  });

  it('captureWithTwoPipelinesShowsPicker', async () => {
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: summary() },
        [PIPELINES]: {
          status: 200,
          body: [samplePipeline(), samplePipeline({ id: 'p2', name: 'Support', isDefault: false })],
        },
        [CAPTURE]: { status: 200, body: { contact: captured('Asha Rao').contact, deal: null, createdContact: true, createdDeal: false } },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    await user.click(await screen.findByRole('button', { name: 'Capture to CRM' }));
    const dialog = await screen.findByRole('dialog');
    const pick = await within(dialog).findByLabelText('Pipeline');
    expect(pick).toHaveValue('p1');
    await user.selectOptions(pick, 'p2');
    await user.type(within(dialog).getByLabelText('Deal title (optional)'), 'Big one');
    await user.click(within(dialog).getByRole('button', { name: 'Capture' }));
    await waitFor(() => expect(requestTo(f, CAPTURE)?.body).toEqual({ chatId: 'c1', pipelineId: 'p2', dealTitle: 'Big one' }));
  });

  it('captureOfAnExistingContactRefetchesTheSummary', async () => {
    let n = 0;
    const f = mockFetch(
      routes({
        [SUMMARY1]: () =>
          ++n === 1
            ? { status: 200, body: summary() }
            : {
                status: 200,
                body: {
                  ...captured('Asha Rao'),
                  openDeals: [sampleDeal(), sampleDeal({ id: 'd9', title: 'Older deal' })],
                },
              },
        [CAPTURE]: { status: 200, body: { contact: captured('Asha Rao').contact, deal: null, createdContact: false, createdDeal: false } },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    await user.click(await screen.findByRole('button', { name: 'Capture to CRM' }));
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Capture' }));
    expect(await screen.findByRole('link', { name: 'Older deal' })).toBeVisible();
    expect(callsTo(f, SUMMARY1)).toBe(2);
  });

  it('restrictedUserOnlyGetsTheirPipelines', async () => {
    mockFetch(
      routes({
        [STATUS]: { status: 200, body: crmStatus({ pipelineAccess: ['p2'] }) },
        [SUMMARY1]: { status: 200, body: summary() },
        [PIPELINES]: {
          status: 200,
          body: [samplePipeline(), samplePipeline({ id: 'p2', name: 'Support', isDefault: false })],
        },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    await user.click(await screen.findByRole('button', { name: 'Capture to CRM' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Deal title (optional)');
    expect(within(dialog).queryByLabelText('Pipeline')).toBeNull();
  });

  it.each([
    ['CHAT_NOT_ASSIGNED', 'Assign this chat to yourself or your team to capture it.'],
    ['NO_PIPELINE_ACCESS', 'No pipeline is assigned to you yet.'],
    ['NO_EDIT', 'You can view the CRM but not add to it.'],
  ])('blockedReasonCopy %s', async (reason, copy) => {
    mockFetch(routes({ [SUMMARY1]: { status: 200, body: summary({ canCapture: false, captureBlockedReason: reason }) } }));
    renderApp('/inbox/chats/c1');
    expect(await screen.findByText(copy)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Capture to CRM' })).toBeDisabled();
  });

  it('capturedShowsDealsAndLifecycleSaves', async () => {
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: captured('Priya Shah') },
        [UPDATE]: { status: 200, body: { ...captured('Priya Shah').contact, lifecycleStatus: 'customer', version: 6 } },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    const panel = within(await screen.findByRole('complementary', { name: 'CRM' }));
    expect(await panel.findByRole('link', { name: 'Acme order' })).toHaveAttribute('href', '/crm/deals/d1?pipelineId=p1');
    expect(panel.getByText(/New/)).toBeVisible();
    expect(panel.getByText(/₹1,500/)).toBeVisible();
    expect(panel.getByRole('link', { name: 'Open in CRM' })).toHaveAttribute('href', '/crm/contacts/k1');
    const select = await panel.findByLabelText('Lifecycle status');
    expect(select).toHaveValue('lead');
    await user.selectOptions(select, 'customer');
    await waitFor(() => expect(requestTo(f, UPDATE)?.body).toEqual({ lifecycleStatus: 'customer', version: 5 }));
    await waitFor(() => expect(select).toHaveValue('customer'));
  });

  it('lifecycleConflictReloadsTheSummary', async () => {
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: captured('Priya Shah') },
        [UPDATE]: { status: 409, body: { code: 'VERSION_CONFLICT', message: 'x' } },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    const panel = within(await screen.findByRole('complementary', { name: 'CRM' }));
    await user.selectOptions(await panel.findByLabelText('Lifecycle status'), 'customer');
    await waitFor(() => expect(callsTo(f, SUMMARY1)).toBe(2));
  });

  it('inboxPanelShowsNextTaskAndAddsFollowUp', async () => {
    const next = sampleTask({ title: 'Send catalogue', target: { type: 'CONTACT', id: 'k1', name: 'Asha Rao' } });
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: { ...captured('Asha Rao'), nextTask: next } },
        [`POST ${B}/crm/tasks`]: { status: 200, body: sampleTask({ title: 'Follow up' }) },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    const panel = document.body;
    expect(await within(panel).findByText('Send catalogue')).toBeInTheDocument();
    expect(within(panel).getByText(/^in (59 minutes|1 hour)$/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Add follow-up' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText(/^Title/), 'Follow up');
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, `POST ${B}/crm/tasks`)).toBeDefined());
    expect(requestTo(f, `POST ${B}/crm/tasks`)?.body).toMatchObject({
      title: 'Follow up',
      target: { type: 'CONTACT', id: 'k1' },
    });
  });

  it('logCallOpensTheFormOnTheContact', async () => {
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: captured('Priya Shah') },
        [`POST ${B}/crm/activities/log`]: { status: 200, body: { id: 'a1' } },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    const panel = within(await screen.findByRole('complementary', { name: 'CRM' }));
    await user.click(await panel.findByRole('button', { name: 'Log call' }));
    await user.type(panel.getByLabelText('Summary'), 'Spoke about the quote');
    await user.click(panel.getByRole('button', { name: 'Log activity' }));
    await waitFor(() => expect(requestTo(f, `POST ${B}/crm/activities/log`)?.body).toMatchObject({
      target: { type: 'CONTACT', id: 'k1' },
      type: 'CALL',
      summary: 'Spoke about the quote',
    }));
  });

  it('errorShowsRetryAndChatStaysUsable', async () => {
    let n = 0;
    mockFetch(
      routes({
        [SUMMARY1]: () => (++n === 1 ? { status: 500, body: { code: 'X', message: 'boom' } } : { status: 200, body: summary() }),
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    const panel = within(await screen.findByRole('complementary', { name: 'CRM' }));
    expect(await panel.findByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Chat header' })).toBeVisible();
    await user.click(panel.getByRole('button', { name: 'Retry' }));
    expect(await panel.findByRole('button', { name: 'Capture to CRM' })).toBeVisible();
  });

  it('switchingChatReloadsSummary', async () => {
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: captured('Priya Shah') },
        [SUMMARY2]: { status: 200, body: captured('Meena Nair', 'c2') },
      }),
    );
    const { user } = renderApp('/inbox/chats/c1');
    expect(await screen.findByRole('link', { name: 'Priya Shah' })).toBeVisible();
    await user.click(within(await screen.findByRole('list', { name: 'Chats' })).getByRole('button', { name: /Meena/ }));
    expect(await screen.findByRole('link', { name: 'Meena Nair' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Priya Shah' })).toBeNull();
    expect(callsTo(f, SUMMARY1)).toBe(1);
    expect(callsTo(f, SUMMARY2)).toBe(1);
  });

  it('staleAnswerIgnored', async () => {
    const f = mockFetch(
      routes({
        [SUMMARY1]: { status: 200, body: captured('Priya Shah') },
        [SUMMARY2]: { status: 200, body: captured('Meena Nair', 'c2') },
      }),
    );
    const held = gate(f, SUMMARY1, 1);
    const { user } = renderApp('/inbox/chats/c1');
    await waitFor(() => expect(callsTo(f, SUMMARY1)).toBe(1));
    await user.click(within(await screen.findByRole('list', { name: 'Chats' })).getByRole('button', { name: /Meena/ }));
    expect(await screen.findByRole('link', { name: 'Meena Nair' })).toBeVisible();
    await act(async () => {
      held.release();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByRole('link', { name: 'Meena Nair' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Priya Shah' })).toBeNull();
  });

  it('toggleCollapsesAndRemembersPerUser', async () => {
    mockFetch(routes({ [SUMMARY1]: { status: 200, body: summary() } }));
    const { user } = renderApp('/inbox/chats/c1');
    await screen.findByRole('complementary', { name: 'CRM' });
    await user.click(screen.getByRole('button', { name: 'CRM panel' }));
    expect(screen.queryByRole('complementary', { name: 'CRM' })).toBeNull();
    expect(localStorage.getItem('crm.panel.u4')).toBe('collapsed');
  });

  it('underElevenHundredPixelsThePanelIsADrawerOpenedByTheToggle', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 1099px)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const f = mockFetch(routes({ [SUMMARY1]: { status: 200, body: summary() } }));
    const { user } = renderApp('/inbox/chats/c1');
    await user.click(await screen.findByRole('button', { name: 'CRM panel' }));
    expect(await screen.findByRole('button', { name: 'Capture to CRM' })).toBeVisible();
    expect(callsTo(f, SUMMARY1)).toBe(1);
    await user.click(screen.getByRole('button', { name: 'CRM panel' }));
    expect(screen.queryByRole('complementary', { name: 'CRM' })).toBeNull();
  });

  it('startsCollapsedWhenStored', async () => {
    localStorage.setItem('crm.panel.u4', 'collapsed');
    const f = mockFetch(routes({ [SUMMARY1]: { status: 200, body: summary() } }));
    renderApp('/inbox/chats/c1');
    await screen.findByRole('group', { name: 'Chat header' });
    await screen.findByRole('button', { name: 'CRM panel' });
    expect(screen.queryByRole('complementary', { name: 'CRM' })).toBeNull();
    expect(callsTo(f, SUMMARY1)).toBe(0);
  });

  it('newChatQueryOpensPrefilledModal', async () => {
    mockFetch(routes());
    renderApp('/inbox?newChat=p1&phone=919811111111', <Search />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Phone number/)).toHaveValue('919811111111');
    expect(within(dialog).getByText(/Sales/)).toBeVisible();
    // The params are consumed.
    await waitFor(() => expect(screen.getByLabelText('Query string').textContent).toBe(''));
  });

  it('newChatQueryForUnknownNumberIsIgnored', async () => {
    mockFetch(routes());
    renderApp('/inbox?newChat=nope&phone=919811111111');
    await screen.findByRole('list', { name: 'Chats' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
