import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MessageView } from '@app/api/inbox';
import { NewChatModal } from '@app/Inbox/NewChatModal';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';
import { content, template } from '../../test/templates';

const START = 'POST /api/workspaces/w1/inbox/phone-numbers/p1/chats';
const TEMPLATES = 'GET /api/workspaces/w1/templates';
const RENDER = 'POST /api/workspaces/w1/templates/t1/render';

const STARTED: MessageView = {
  id: 'm1',
  chatId: 'c9',
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
  numberConnected: boolean;
  onClose(): void;
  onStarted(m: MessageView): void;
}> = (props) => {
  const { status } = useSession();
  return status === 'signedIn' ? <NewChatModal phoneNumberId="p1" {...props} /> : null;
};

function renderModal(over: { numberConnected?: boolean } = {}) {
  const onStarted = vi.fn();
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <SessionProvider>
        <Host numberConnected={over.numberConnected ?? true} onClose={onClose} onStarted={onStarted} />
      </SessionProvider>
    </ThemeProvider>,
  );
  return { user, onStarted, onClose };
}

const phoneBox = () => screen.findByRole('textbox', { name: 'Phone number' });
const messageBox = () => screen.findByRole('textbox', { name: 'Message' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });
const templateButton = () => screen.getByRole('button', { name: 'Template…' });

const welcome = template({ id: 't1', name: 'Welcome', content: content({ body: 'Hi there' }) });

describe('new chat modal', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends a text to a cleaned phone number', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [START]: { status: 200, body: STARTED } });
    const { user, onStarted } = renderModal();
    expect(await screen.findByText('New chat')).toBeInTheDocument();
    expect(screen.getByText('Country code first, digits only, e.g. 919812345678')).toBeInTheDocument();
    await user.type(await phoneBox(), '+91 98111-11111');
    await user.type(await messageBox(), '  hello  ');
    await user.click(sendButton());
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(STARTED));
    expect(requestTo(fetch, START)?.body).toEqual({ phone: '919811111111', text: 'hello' });
  });

  it('sends on Enter in the phone box when Send is enabled', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [START]: { status: 200, body: STARTED } });
    const { user, onStarted } = renderModal();
    await user.type(await messageBox(), 'hello');
    await user.type(await phoneBox(), '919811111111{Enter}');
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    expect(callsTo(fetch, START)).toBe(1);
  });

  it('does not submit on Enter while Send is disabled', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND) });
    const { user } = renderModal();
    await user.type(await phoneBox(), '919811111111{Enter}');
    expect(sendButton()).toBeDisabled();
    expect(callsTo(fetch, START)).toBe(0);
  });

  it('rejects a bad phone number before calling the server', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND) });
    const { user } = renderModal();
    await user.type(await phoneBox(), '12');
    expect(screen.queryByText('Enter 8 to 15 digits with the country code')).not.toBeInTheDocument();
    await user.tab();
    expect(await screen.findByText('Enter 8 to 15 digits with the country code')).toBeInTheDocument();
    await user.type(await messageBox(), 'hello');
    expect(sendButton()).toBeDisabled();
    expect(templateButton()).toBeDisabled();
    expect(callsTo(fetch, START)).toBe(0);
  });

  it('counts characters after 3900', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    renderModal();
    expect(screen.queryByText(/\/ 4096/)).not.toBeInTheDocument();
    fireEvent.change(await messageBox(), { target: { value: 'x'.repeat(3901) } });
    expect(screen.getByText('3901 / 4096')).toBeInTheDocument();
    expect(await messageBox()).toHaveAttribute('maxlength', '4096');
  });

  it('sendsOnce', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [START]: { status: 200, body: STARTED } });
    const answer = fetch.getMockImplementation() as NonNullable<ReturnType<typeof fetch.getMockImplementation>>;
    fetch.mockImplementation(async (input, init) => {
      if (new URL(String(input), 'http://localhost').pathname.endsWith('/chats')) await gate;
      return answer(input, init);
    });
    const { user, onStarted } = renderModal();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    await user.click(sendButton());
    await waitFor(() => expect(sendButton()).toBeDisabled());
    await user.click(sendButton());
    await user.type(await phoneBox(), '{Enter}');
    release();
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    expect(callsTo(fetch, START)).toBe(1);
  });

  it('serverPhoneErrorLandsUnderTheField', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [START]: { status: 400, body: { code: 'VALIDATION', fields: { phone: 'must be 8 to 15 digits' } } },
    });
    const { user, onStarted } = renderModal();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    await user.click(sendButton());
    expect(await screen.findByText('must be 8 to 15 digits')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onStarted).not.toHaveBeenCalled();
    // Editing the number clears the server's complaint about it.
    await user.type(await phoneBox(), '0');
    expect(screen.queryByText('must be 8 to 15 digits')).not.toBeInTheDocument();
  });

  it('serverTextErrorLandsUnderTheMessage', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [START]: { status: 400, body: { code: 'VALIDATION', fields: { text: 'must not be blank' } } },
    });
    const { user } = renderModal();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    await user.click(sendButton());
    expect(await screen.findByText('must not be blank')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the taken-chat message', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [START]: { status: 409, body: { code: 'CHAT_TAKEN' } } });
    const { user, onStarted } = renderModal();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    await user.click(sendButton());
    const alert = await screen.findByText('This number already has a chat assigned to someone else.');
    expect(alert).toBeInTheDocument();
    expect(onStarted).not.toHaveBeenCalled();
    expect(await messageBox()).toHaveValue('hello');
  });

  it('disabledWhenNotConnected', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    const { user } = renderModal({ numberConnected: false });
    expect(await screen.findByText('WhatsApp is not connected on this number')).toBeInTheDocument();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    expect(sendButton()).toBeDisabled();
    expect(templateButton()).toBeDisabled();
  });

  it('Cancel closes', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    const { user, onClose } = renderModal();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends a template as the first message', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [TEMPLATES]: { status: 200, body: [welcome] },
      'GET /api/workspaces/w1/templates/t1': { status: 200, body: welcome },
      [RENDER]: {
        status: 200,
        body: {
          type: 'TEXT',
          content: content({ body: 'Hi there' }),
          media: null,
          vcard: null,
          missing: [],
          warnings: [],
        },
      },
      [START]: { status: 200, body: { ...STARTED, templateId: 't1' } },
    });
    const { user, onStarted } = renderModal();
    expect(await screen.findByText('New chat')).toBeInTheDocument();
    expect(templateButton()).toBeDisabled();
    await user.type(await phoneBox(), '+91 98111-11111');
    await user.click(templateButton());
    await user.click(await screen.findByRole('menuitem', { name: /Welcome/ }));
    expect(await screen.findByText('Hi there')).toBeInTheDocument();
    expect(requestTo(fetch, RENDER)?.body).toEqual({ values: {} });
    const picker = screen.getByRole('dialog', { name: 'Send a template' });
    const send = within(picker).getByRole('button', { name: 'Send' });
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    expect(requestTo(fetch, START)?.body).toEqual({ phone: '919811111111', templateId: 't1', values: {} });
  });
});
