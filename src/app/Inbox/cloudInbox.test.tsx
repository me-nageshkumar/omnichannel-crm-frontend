import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ChatView, MessageView } from '@app/api/inbox';
import type { PhoneNumber } from '@app/api/phoneNumbers';
import { Composer } from '@app/Inbox/Composer';
import { MessageBubble } from '@app/Inbox/MessageBubble';
import { NewChatModal } from '@app/Inbox/NewChatModal';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';
import { phoneNumber } from '../../test/phoneNumbers';
import { cloudTemplate } from '../../test/cloudTemplates';

const SEND = 'POST /api/workspaces/w1/inbox/chats/c1/messages';
const SEND_TEMPLATE = 'POST /api/workspaces/w1/inbox/chats/c1/cloud-templates';
const TEMPLATES = 'GET /api/workspaces/w1/meta/templates';
const UPLOAD = 'POST /api/workspaces/w1/channel-accounts/p2/media';

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

const CLOUD_CHAT: ChatView = {
  id: 'c1',
  phoneNumberId: 'p2',
  remoteId: '919799750743@c.us',
  contact: { id: 'ct1', name: 'Veenu', phone: '919799750743', numberHidden: false },
  status: 'OPEN',
  assignedUser: null,
  assignedTeam: null,
  unreadCount: 0,
  lastMessageAt: null,
  lastMessage: null,
  creationTime: '2026-11-20T10:00:00Z',
  lastAgent: null,
  adClick: null,
  otherChats: [],
  channel: 'WHATSAPP_CLOUD',
  window: { open: true, closesAt: inMs(3 * 3600_000) },
};

const SENT: MessageView = {
  id: 'm1',
  chatId: 'c1',
  waMessageId: 'wamid.T1',
  direction: 'OUT',
  source: 'CONSOLE',
  type: 'template',
  body: 'Hi Veenu, your BCA admission is open',
  media: null,
  location: null,
  timestamp: '2026-11-20T10:00:00Z',
  status: 'SENT',
  statusTimes: { sentAt: null, deliveredAt: null, readAt: null, playedAt: null, failedAt: null },
  sentBy: null,
  templateId: null,
  messagePageId: null,
  messagePage: null,
  adClick: null,
};

const FOLLOW_UP = cloudTemplate({
  id: 't1',
  name: 'course_follow_up',
  fills: { 'body:1': { kind: 'CONTACT_FIELD', attributeKey: 'name' } },
});
const BROCHURE = cloudTemplate({
  id: 't2',
  name: 'brochure',
  components: [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Our brochure' },
  ],
  header: { format: 'IMAGE' },
  variables: [],
});

const Host: React.FunctionComponent<{ chat: ChatView; onSent(m: MessageView): void }> = (props) => {
  const { status } = useSession();
  return status === 'signedIn' ? <Composer numberConnected {...props} /> : null;
};

function renderComposer(chat: ChatView = CLOUD_CHAT) {
  const onSent = vi.fn();
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <Host chat={chat} onSent={onSent} />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  );
  return { user, onSent };
}

describe('Cloud chats in the inbox', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('windowLineOpen', async () => {
    mockFetch(meAs(AGENT_IN_BRAND));
    renderComposer();
    expect(await screen.findByText('Replies close in 3 hours')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'WhatsApp template' })).toBeEnabled();
  });

  it('windowClosedDisablesText', async () => {
    mockFetch(meAs(AGENT_IN_BRAND));
    renderComposer({ ...CLOUD_CHAT, window: { open: false, closesAt: inMs(-3600_000) } });
    expect(await screen.findByText('24-hour window closed — send a WhatsApp template')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'WhatsApp template' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Template' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('windowClosesWhileOpen', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    mockFetch(meAs(AGENT_IN_BRAND));
    renderComposer({ ...CLOUD_CHAT, window: { open: true, closesAt: inMs(30_000) } });
    expect(await screen.findByText('Replies close in less than a minute')).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(await screen.findByText('24-hour window closed — send a WhatsApp template')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });

  it('windowClosedErrorShown', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [SEND]: { status: 409, body: { code: 'WINDOW_CLOSED', field: 'window', message: 'closed', closesAt: inMs(-1) } },
    });
    const { user } = renderComposer();
    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'Hello{Enter}');
    expect(await screen.findByText('24-hour window closed — send a WhatsApp template')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });

  it('pickerPrefillsAndSends', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [TEMPLATES]: { status: 200, body: [FOLLOW_UP] },
      [SEND_TEMPLATE]: { status: 200, body: SENT },
    });
    const { user, onSent } = renderComposer();
    await user.click(await screen.findByRole('button', { name: 'WhatsApp template' }));
    await user.click(await screen.findByRole('menuitem', { name: /course_follow_up/ }));
    const first = await screen.findByLabelText(/^body:1/);
    expect(first).toHaveValue('Veenu');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(screen.getByLabelText(/^body:2/), 'BCA');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(requestTo(fetch, SEND_TEMPLATE)?.body).toEqual({
      cloudTemplateId: 't1',
      values: { 'body:1': 'Veenu', 'body:2': 'BCA' },
    });
    expect(String(fetch.mock.calls.find(([u]) => String(u).includes('/meta/templates'))?.[0])).toContain(
      'phoneNumberId=p2',
    );
  });

  it('headerImageNeedsFile', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [TEMPLATES]: { status: 200, body: [BROCHURE] },
      [UPLOAD]: { status: 200, body: { id: 'cm1' } },
      [SEND_TEMPLATE]: { status: 200, body: SENT },
    });
    const { user } = renderComposer();
    await user.click(await screen.findByRole('button', { name: 'WhatsApp template' }));
    await user.click(await screen.findByRole('menuitem', { name: /brochure/ }));
    expect(await screen.findByRole('button', { name: 'Send' })).toBeDisabled();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['png'], 'brochure.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(requestTo(fetch, SEND_TEMPLATE)).toBeDefined());
    expect(requestTo(fetch, SEND_TEMPLATE)?.body).toEqual({ cloudTemplateId: 't2', values: {}, headerMediaId: 'cm1' });
  });

  it('webChatHasNoWindowLine', async () => {
    mockFetch(meAs(AGENT_IN_BRAND));
    renderComposer({ ...CLOUD_CHAT, channel: 'WHATSAPP_WEB', window: null });
    expect(await screen.findByRole('textbox', { name: 'Message' })).toBeEnabled();
    expect(screen.queryByText(/Replies close/)).toBeNull();
    expect(screen.queryByText(/24-hour window/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'WhatsApp template' })).toBeNull();
  });

  it('templateBubbleDraws', () => {
    render(
      <MessageBubble
        side="right"
        contact="Veenu"
        message={{
          ...SENT,
          template: {
            name: 'course_follow_up',
            language: 'en',
            header: { format: 'TEXT', text: 'Admissions open', mediaId: null },
            body: 'Hi Veenu, your BCA admission is open',
            footer: 'Bimal Institute',
            buttons: [
              { type: 'QUICK_REPLY', text: 'Call me' },
              { type: 'QUICK_REPLY', text: 'Not now' },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText('Admissions open')).toBeVisible();
    expect(screen.getByText('Hi Veenu, your BCA admission is open')).toBeVisible();
    expect(screen.getByText('Bimal Institute')).toBeVisible();
    expect(screen.getByText('Call me')).toBeVisible();
    expect(screen.getByText('Not now')).toBeVisible();
  });

  it('failedMessageShowsMetaTitle', () => {
    render(
      <MessageBubble
        side="right"
        contact="Veenu"
        message={{
          ...SENT,
          type: 'text',
          body: 'Hi',
          status: 'FAILED',
          failure: { code: 131026, title: 'Message undeliverable', details: null },
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Not delivered: Message undeliverable');
  });

  it('newChatOnCloudUsesTemplate', async () => {
    const number: PhoneNumber = phoneNumber({
      id: 'p2',
      number: '919876543210',
      connectionType: 'WHATSAPP_CLOUD_API',
      status: 'NOT_CONNECTED_YET',
      cloud: {
        connectionId: 'c1',
        connectionName: 'Bimal app',
        wabaId: '222',
        metaPhoneNumberId: '333',
        verifiedName: 'Bimal Institute',
        nameStatus: 'APPROVED',
        qualityRating: 'GREEN',
        messagingLimitTier: 'TIER_250',
        registered: true,
        state: 'READY',
        lastError: null,
      },
    });
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [TEMPLATES]: { status: 200, body: [cloudTemplate({ id: 't1', name: 'course_follow_up', variables: [] })] },
      'POST /api/workspaces/w1/inbox/phone-numbers/p2/chats': { status: 200, body: SENT },
    });
    const onStarted = vi.fn();
    const user = userEvent.setup();
    const NewChatHost = () => {
      const { status } = useSession();
      return status === 'signedIn' ? (
        <NewChatModal numbers={[number]} onClose={() => undefined} onStarted={onStarted} />
      ) : null;
    };
    render(
      <ThemeProvider>
        <SessionProvider>
          <MemoryRouter>
            <NewChatHost />
          </MemoryRouter>
        </SessionProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByText(/must be an approved WhatsApp template/)).toBeVisible();
    expect(screen.queryByLabelText(/^Message/)).toBeNull();
    await user.type(screen.getByLabelText(/^Phone number/), '919811122233');
    await user.click(screen.getByRole('button', { name: 'WhatsApp template…' }));
    await user.click(await screen.findByRole('menuitem', { name: /course_follow_up/ }));
    await user.click(await screen.findByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(requestTo(fetch, 'POST /api/workspaces/w1/inbox/phone-numbers/p2/chats')?.body).toEqual({
      phone: '919811122233',
      cloudTemplate: { cloudTemplateId: 't1', values: {} },
    });
    expect(fetch.mock.calls.some(([u]) => String(u).includes('number-lookup'))).toBe(false);
  });
});
