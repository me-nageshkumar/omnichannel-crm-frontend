import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatView, MessageView } from '@app/api/inbox';
import { Composer } from '@app/Inbox/Composer';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';
import { content, placeholderView, template } from '../../test/templates';

const SEND = 'POST /api/workspaces/w1/inbox/chats/c1/messages';
const TEMPLATES = 'GET /api/workspaces/w1/templates';
const RENDER = 'POST /api/workspaces/w1/templates/t1/render';

const CHAT: ChatView = {
  id: 'c1',
  phoneNumberId: 'p1',
  remoteId: '919900000001@c.us',
  contact: { id: 'ct1', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
  status: 'OPEN',
  assignedUser: null,
  assignedTeam: null,
  unreadCount: 0,
  lastMessageAt: null,
  lastMessage: null,
  creationTime: '2026-10-20T10:00:00Z',
  lastAgent: null,
};

const SENT: MessageView = {
  id: 'm1',
  chatId: 'c1',
  waMessageId: 'wa-m1',
  direction: 'OUT',
  source: 'CONSOLE',
  type: 'text',
  body: 'hello',
  media: null,
  location: null,
  timestamp: '2026-10-21T10:00:00Z',
  status: 'SENT',
  statusTimes: { sentAt: null, deliveredAt: null, readAt: null, playedAt: null, failedAt: null },
  sentBy: null,
  templateId: null,
};

const Host: React.FunctionComponent<{
  chat: ChatView;
  numberConnected: boolean;
  onSent(m: MessageView): void;
}> = (props) => {
  const { status } = useSession();
  return status === 'signedIn' ? <Composer {...props} /> : null;
};

function renderComposer(over: { chat?: ChatView; numberConnected?: boolean } = {}) {
  const onSent = vi.fn();
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <SessionProvider>
        <Host chat={over.chat ?? CHAT} numberConnected={over.numberConnected ?? true} onSent={onSent} />
      </SessionProvider>
    </ThemeProvider>,
  );
  return { user, onSent };
}

const box = () => screen.findByRole('textbox', { name: 'Message' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });

const welcome = template({ id: 't1', name: 'Welcome', content: content({ body: 'Hi {{contact.name}}' }) });
const order = template({
  id: 't2',
  name: 'Order update',
  content: content({ body: 'Order {{order_id}}' }),
  placeholders: [placeholderView({ name: 'order_id', label: 'Order ID', example: 'A-1', required: true })],
});
const card = template({ id: 't3', name: 'Our card', type: 'CONTACT_CARD' });

const rendered = (body: string, missing: string[] = []) => ({
  status: 200,
  body: { type: 'TEXT', content: content({ body }), media: null, vcard: null, missing, warnings: [] },
});

describe('composer', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('enter sends trimmed text and clears', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [SEND]: { status: 200, body: SENT } });
    const { user, onSent } = renderComposer();
    await user.type(await box(), '  hello  {Enter}');
    await waitFor(() => expect(onSent).toHaveBeenCalledWith(SENT));
    expect(requestTo(fetch, SEND)?.body).toEqual({ text: 'hello' });
    expect(await box()).toHaveValue('');
  });

  it('shift+enter inserts newline, nothing sent', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND) });
    const { user } = renderComposer();
    await user.type(await box(), 'a{Shift>}{Enter}{/Shift}b');
    expect(await box()).toHaveValue('a\nb');
    expect(callsTo(fetch, SEND)).toBe(0);
  });

  it('blank text does not send', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND) });
    const { user } = renderComposer();
    await user.type(await box(), '   {Enter}');
    expect(sendButton()).toBeDisabled();
    expect(callsTo(fetch, SEND)).toBe(0);
  });

  it('send in flight disables the button', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [SEND]: { status: 200, body: SENT } });
    const answer = fetch.getMockImplementation() as NonNullable<ReturnType<typeof fetch.getMockImplementation>>;
    fetch.mockImplementation(async (input, init) => {
      if (new URL(String(input), 'http://localhost').pathname.endsWith('/messages')) await gate;
      return answer(input, init);
    });
    const { user, onSent } = renderComposer();
    await user.type(await box(), 'hello');
    await user.click(sendButton());
    await waitFor(() => expect(sendButton()).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Template' })).toBeDisabled();
    await user.type(await box(), '{Enter}');
    release();
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(callsTo(fetch, SEND)).toBe(1);
    await user.type(await box(), 'again');
    expect(sendButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Template' })).toBeEnabled();
  });

  it('keeps what was typed while the send was in flight', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [SEND]: { status: 200, body: SENT } });
    const answer = fetch.getMockImplementation() as NonNullable<ReturnType<typeof fetch.getMockImplementation>>;
    fetch.mockImplementation(async (input, init) => {
      if (new URL(String(input), 'http://localhost').pathname.endsWith('/messages')) await gate;
      return answer(input, init);
    });
    const { user, onSent } = renderComposer();
    await user.type(await box(), 'hello');
    await user.click(sendButton());
    await waitFor(() => expect(sendButton()).toBeDisabled());
    await user.type(await box(), ' and more');
    release();
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(await box()).toHaveValue('hello and more');
    expect(requestTo(fetch, SEND)?.body).toEqual({ text: 'hello' });
  });

  it('shows the error and keeps the text when the send fails', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [SEND]: { status: 409, body: { code: 'NO_DEVICE' } } });
    const { user, onSent } = renderComposer();
    await user.type(await box(), 'hello{Enter}');
    expect(await screen.findByText('WhatsApp is not connected on this number.')).toBeInTheDocument();
    expect(await box()).toHaveValue('hello');
    expect(onSent).not.toHaveBeenCalled();
  });

  it('shows a text validation error under the textarea', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [SEND]: { status: 400, body: { code: 'VALIDATION', fields: { text: 'must not be blank' } } },
    });
    const { user } = renderComposer();
    await user.type(await box(), 'hello{Enter}');
    expect(await screen.findByText('must not be blank')).toBeInTheDocument();
  });

  it('counts characters after 3900', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    renderComposer();
    expect(screen.queryByText(/\/ 4096/)).not.toBeInTheDocument();
    fireEvent.change(await box(), { target: { value: 'x'.repeat(3901) } });
    expect(screen.getByText('3901 / 4096')).toBeInTheDocument();
    expect(await box()).toHaveAttribute('maxlength', '4096');
  });

  it('closed chat shows Reopen to reply and no textarea input', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    renderComposer({ chat: { ...CHAT, status: 'CLOSED' } });
    expect(await screen.findByText('Reopen to reply')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
    expect(sendButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Template' })).toBeDisabled();
  });

  it('not connected shows the notice', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    renderComposer({ numberConnected: false });
    expect(await screen.findByText('WhatsApp is not connected on this number')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
    expect(sendButton()).toBeDisabled();
  });
});

describe('template picker', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  const serve = (extra = {}) =>
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [TEMPLATES]: { status: 200, body: [welcome, order, card] },
      'GET /api/workspaces/w1/templates/t1': { status: 200, body: welcome },
      'GET /api/workspaces/w1/templates/t2': { status: 200, body: order },
      ...extra,
    });

  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Template' }));
  };

  it('template picker lists active templates, disables contact cards', async () => {
    const fetch = serve();
    const { user } = renderComposer();
    await open(user);
    expect(await screen.findByRole('menuitem', { name: /Welcome/ })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: /Order update/ })).toBeEnabled();
    const disabled = screen.getByRole('menuitem', { name: /Our card/ });
    expect(disabled).toBeDisabled();
    expect(screen.getByText('Not sendable from the inbox yet')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([u]) => String(u).includes('status=ACTIVE'))).toBe(true);
  });

  it('searches templates with the typed text', async () => {
    const fetch = serve();
    const { user } = renderComposer();
    await open(user);
    await screen.findByRole('menuitem', { name: /Welcome/ });
    await user.type(screen.getByRole('textbox', { name: 'Search templates' }), 'ord');
    await waitFor(() => expect(fetch.mock.calls.some(([u]) => String(u).includes('q=ord'))).toBe(true));
  });

  it('template send posts templateId and values', async () => {
    const fetch = serve({
      'POST /api/workspaces/w1/templates/t2/render': (req: { body: { values: Record<string, string> } }) =>
        rendered(`Order ${req.body.values.order_id}`),
      [SEND]: { status: 200, body: { ...SENT, templateId: 't2' } },
    });
    const { user, onSent } = renderComposer();
    await open(user);
    await user.click(await screen.findByRole('menuitem', { name: /Order update/ }));
    const field = await screen.findByLabelText(/Order ID/);
    expect(field).toHaveValue('A-1');
    expect(screen.getByText('A-1', { selector: '.pf-v6-c-helper-text__item-text' })).toBeInTheDocument();
    expect(await screen.findByText('Order A-1')).toBeInTheDocument();
    expect(requestTo(fetch, 'POST /api/workspaces/w1/templates/t2/render')?.body).toEqual({
      contactId: 'ct1',
      values: { order_id: 'A-1' },
    });
    fireEvent.change(field, { target: { value: 'B-9' } });
    expect(await screen.findByText('Order B-9')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
    await user.click(sendButton());
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(requestTo(fetch, SEND)?.body).toEqual({ templateId: 't2', values: { order_id: 'B-9' } });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('missing required value shows a field error and sends nothing', async () => {
    const fetch = serve({
      'POST /api/workspaces/w1/templates/t2/render': (req: { body: { values: Record<string, string> } }) =>
        req.body.values.order_id ? rendered('Order A-1') : rendered('Order ', ['order_id']),
      [SEND]: { status: 200, body: SENT },
    });
    const { user } = renderComposer();
    await open(user);
    await user.click(await screen.findByRole('menuitem', { name: /Order update/ }));
    const field = await screen.findByLabelText(/Order ID/);
    await screen.findByText('Order A-1');
    fireEvent.change(field, { target: { value: '' } });
    expect(await screen.findByText('Required')).toBeInTheDocument();
    const send = sendButton();
    expect(send).toBeDisabled();
    await user.click(send);
    expect(callsTo(fetch, SEND)).toBe(0);
  });

  it('clears a render error once a later render succeeds', async () => {
    let renders = 0;
    serve({
      'POST /api/workspaces/w1/templates/t2/render': () => (++renders === 1 ? { status: 500 } : rendered('Order B-9')),
      [SEND]: { status: 200, body: SENT },
    });
    const { user } = renderComposer();
    await open(user);
    await user.click(await screen.findByRole('menuitem', { name: /Order update/ }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    fireEvent.change(await screen.findByLabelText(/Order ID/), { target: { value: 'B-9' } });
    expect(await screen.findByText('Order B-9')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it('maps a server validation error to its field', async () => {
    serve({
      'POST /api/workspaces/w1/templates/t2/render': rendered('Order A-1'),
      [SEND]: { status: 400, body: { code: 'VALIDATION', fields: { order_id: 'is not valid' } } },
    });
    const { user, onSent } = renderComposer();
    await open(user);
    await user.click(await screen.findByRole('menuitem', { name: /Order update/ }));
    await screen.findByText('Order A-1');
    const send = sendButton();
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
    expect(await screen.findByText('is not valid')).toBeInTheDocument();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('a template without agent fields previews and sends with no values', async () => {
    const fetch = serve({ [RENDER]: rendered('Hi Asha'), [SEND]: { status: 200, body: SENT } });
    const { user, onSent } = renderComposer();
    await open(user);
    await user.click(await screen.findByRole('menuitem', { name: /Welcome/ }));
    expect(await screen.findByText('Hi Asha')).toBeInTheDocument();
    const send = sendButton();
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(requestTo(fetch, SEND)?.body).toEqual({ templateId: 't1', values: {} });
  });
});
