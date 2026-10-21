import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MessageView } from '@app/api/inbox';
import { NewChatModal } from '@app/Inbox/NewChatModal';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { urlsOf } from '../../test/admin';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';
import { content, template } from '../../test/templates';

const LOOKUP = 'GET /api/workspaces/w1/inbox/phone-numbers/p1/number-lookup';
const START = 'POST /api/workspaces/w1/inbox/phone-numbers/p1/chats';
const TEMPLATES = 'GET /api/workspaces/w1/templates';
const RENDER = 'POST /api/workspaces/w1/templates/t1/render';

const lookup = (registered: boolean) => ({
  status: 200,
  body: { phone: '919811111111', registered, remoteId: registered ? 'x@lid' : null, checkedAt: 't', cached: false },
});
const NOT_ON = 'This number is not on WhatsApp';

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
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [LOOKUP]: lookup(true),
      [START]: { status: 200, body: STARTED },
    });
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
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [LOOKUP]: lookup(true),
      [START]: { status: 200, body: STARTED },
    });
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
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [LOOKUP]: lookup(true),
      [START]: { status: 200, body: STARTED },
    });
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
      [LOOKUP]: lookup(true),
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
      [LOOKUP]: lookup(true),
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
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [LOOKUP]: lookup(true),
      [START]: { status: 409, body: { code: 'CHAT_TAKEN' } },
    });
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
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND) });
    const { user } = renderModal({ numberConnected: false });
    expect(await screen.findByText('WhatsApp is not connected on this number')).toBeInTheDocument();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    expect(sendButton()).toBeDisabled();
    expect(templateButton()).toBeDisabled();
    // Nothing can be sent, so the number is not looked up either.
    expect(callsTo(fetch, LOOKUP)).toBe(0);
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
      [LOOKUP]: lookup(true),
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

  it('focuses the phone number first', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND) });
    renderModal();
    const box = await phoneBox();
    await waitFor(() => expect(box).toHaveFocus());
  });

  it('Escape in the template picker closes only the picker', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [LOOKUP]: lookup(true),
      [TEMPLATES]: { status: 200, body: [welcome] },
    });
    const { user, onClose } = renderModal();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    await user.click(templateButton());
    await screen.findByRole('dialog', { name: 'Send a template' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Send a template' })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'New chat' })).toBeInTheDocument();
    expect(await phoneBox()).toHaveValue('919811111111');
    expect(await messageBox()).toHaveValue('hello');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores close requests while a send is in flight', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [LOOKUP]: lookup(true),
      [START]: { status: 200, body: STARTED },
    });
    const answer = fetch.getMockImplementation() as NonNullable<ReturnType<typeof fetch.getMockImplementation>>;
    fetch.mockImplementation(async (input, init) => {
      if (new URL(String(input), 'http://localhost').pathname.endsWith('/chats')) await gate;
      return answer(input, init);
    });
    const { user, onStarted, onClose } = renderModal();
    await user.type(await phoneBox(), '919811111111');
    await user.type(await messageBox(), 'hello');
    await user.click(sendButton());
    await waitFor(() => expect(sendButton()).toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'New chat' })).toBeInTheDocument();
    release();
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(STARTED));
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('number lookup', () => {
    it('checks the number on blur and shows On WhatsApp', async () => {
      const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [LOOKUP]: lookup(true) });
      const { user } = renderModal();
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      expect(await screen.findByText('On WhatsApp')).toBeInTheDocument();
      expect(screen.queryByText('Checking WhatsApp…')).not.toBeInTheDocument();
      expect(callsTo(fetch, LOOKUP)).toBe(1);
    });

    it('shows Checking WhatsApp… while the lookup is out', async () => {
      let finish: () => void = () => undefined;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          finish = () => {
            c.enqueue(new TextEncoder().encode(JSON.stringify(lookup(true).body)));
            c.close();
          };
        },
      });
      mockFetch({
        ...meAs(AGENT_IN_BRAND),
        [LOOKUP]: () => new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
      });
      const { user } = renderModal();
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      expect(await screen.findByText('Checking WhatsApp…')).toBeInTheDocument();
      finish();
      expect(await screen.findByText('On WhatsApp')).toBeInTheDocument();
    });

    it('shows not on WhatsApp and disables Send and Template…', async () => {
      const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [LOOKUP]: lookup(false) });
      const { user } = renderModal();
      await user.type(await messageBox(), 'hello');
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      expect(await screen.findByText(NOT_ON)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
      expect(sendButton()).toBeDisabled();
      expect(templateButton()).toBeDisabled();
      await user.click(sendButton());
      expect(callsTo(fetch, START)).toBe(0);
    });

    it('Check again forces a fresh lookup and re-enables Send', async () => {
      let n = 0;
      const fetch = mockFetch({
        ...meAs(AGENT_IN_BRAND),
        [LOOKUP]: () => lookup(n++ > 0),
      });
      const { user } = renderModal();
      await user.type(await messageBox(), 'hello');
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      await user.click(await screen.findByRole('button', { name: 'Check again' }));
      expect(await screen.findByText('On WhatsApp')).toBeInTheDocument();
      expect(urlsOf(fetch, LOOKUP)[0]).not.toContain('force=true');
      expect(urlsOf(fetch, LOOKUP)[1]).toContain('force=true');
      expect(sendButton()).toBeEnabled();
    });

    it('failedLookupKeepsSendEnabled', async () => {
      const fetch = mockFetch({
        ...meAs(AGENT_IN_BRAND),
        [LOOKUP]: { status: 502, body: { code: 'LOOKUP_FAILED', message: 'x' } },
        [START]: { status: 200, body: STARTED },
      });
      const { user, onStarted } = renderModal();
      await user.type(await messageBox(), 'hello');
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      expect(await screen.findByText('Could not check this number')).toBeInTheDocument();
      expect(sendButton()).toBeEnabled();
      await user.click(sendButton());
      await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
      expect(callsTo(fetch, START)).toBe(1);
      expect(callsTo(fetch, LOOKUP)).toBe(1);
    });

    it('changingTheNumberClearsTheAnswer', async () => {
      mockFetch({ ...meAs(AGENT_IN_BRAND), [LOOKUP]: lookup(false) });
      const { user } = renderModal();
      await user.type(await messageBox(), 'hello');
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      expect(await screen.findByText(NOT_ON)).toBeInTheDocument();
      await user.type(await phoneBox(), '2');
      expect(screen.queryByText(NOT_ON)).not.toBeInTheDocument();
      expect(screen.getByText('Country code first, digits only, e.g. 919812345678')).toBeInTheDocument();
      expect(sendButton()).toBeEnabled();
    });

    it('lateAnswerForAnOldNumberIsIgnored', async () => {
      let finish: () => void = () => undefined;
      const slow = new ReadableStream<Uint8Array>({
        start(c) {
          finish = () => {
            c.enqueue(new TextEncoder().encode(JSON.stringify(lookup(false).body)));
            c.close();
          };
        },
      });
      let n = 0;
      const fetch = mockFetch({
        ...meAs(AGENT_IN_BRAND),
        // The first number's lookup is slow; the second number's answers at once.
        [LOOKUP]: () =>
          n++ === 0
            ? new Response(slow, { status: 200, headers: { 'Content-Type': 'application/json' } })
            : lookup(true),
      });
      const { user } = renderModal();
      await user.type(await messageBox(), 'hello');
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      await screen.findByText('Checking WhatsApp…');
      await user.type(await phoneBox(), '2');
      await user.tab();
      expect(await screen.findByText('On WhatsApp')).toBeInTheDocument();
      finish();
      await waitFor(() => expect(callsTo(fetch, LOOKUP)).toBe(2));
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.getByText('On WhatsApp')).toBeInTheDocument();
      expect(screen.queryByText(NOT_ON)).not.toBeInTheDocument();
      expect(sendButton()).toBeEnabled();
    });

    it('recoversWhenTheNumberComesBackAfterADroppedAnswer', async () => {
      let finish: () => void = () => undefined;
      const slow = new ReadableStream<Uint8Array>({
        start(c) {
          finish = () => {
            c.enqueue(new TextEncoder().encode(JSON.stringify(lookup(false).body)));
            c.close();
          };
        },
      });
      let n = 0;
      const fetch = mockFetch({
        ...meAs(AGENT_IN_BRAND),
        [LOOKUP]: () =>
          n++ === 0
            ? new Response(slow, { status: 200, headers: { 'Content-Type': 'application/json' } })
            : lookup(true),
      });
      const { user } = renderModal();
      await user.type(await phoneBox(), '919811111111');
      await user.tab();
      await screen.findByText('Checking WhatsApp…');
      // Edit away without blurring, let the first answer land (it is dropped), then edit back.
      await user.type(await phoneBox(), '2');
      finish();
      await waitFor(() => expect(screen.queryByText('Checking WhatsApp…')).not.toBeInTheDocument());
      await new Promise((r) => setTimeout(r, 20));
      await user.type(await phoneBox(), '{Backspace}');
      expect(screen.queryByText('Checking WhatsApp…')).not.toBeInTheDocument();
      expect(screen.getByText('Country code first, digits only, e.g. 919812345678')).toBeInTheDocument();
      await user.tab();
      expect(await screen.findByText('On WhatsApp')).toBeInTheDocument();
      expect(callsTo(fetch, LOOKUP)).toBe(2);
    });

    it('sendLooksUpAnUncheckedNumberFirst', async () => {
      const fetch = mockFetch({
        ...meAs(AGENT_IN_BRAND),
        [LOOKUP]: lookup(true),
        [START]: { status: 200, body: STARTED },
      });
      const { user, onStarted } = renderModal();
      await user.type(await messageBox(), 'hello');
      await user.type(await phoneBox(), '919811111111{Enter}');
      await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
      expect(callsTo(fetch, LOOKUP)).toBe(1);
      expect(callsTo(fetch, START)).toBe(1);
      const paths = fetch.mock.calls.map(([input]) => new URL(String(input), 'http://localhost').pathname);
      expect(paths.findIndex((p) => p.endsWith('/number-lookup'))).toBeLessThan(
        paths.findIndex((p) => p.endsWith('/chats')),
      );
    });

    it('does not send when the pre-send lookup says not on WhatsApp', async () => {
      const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [LOOKUP]: lookup(false) });
      const { user, onStarted } = renderModal();
      await user.type(await messageBox(), 'hello');
      await user.type(await phoneBox(), '919811111111{Enter}');
      expect(await screen.findByText(NOT_ON)).toBeInTheDocument();
      expect(callsTo(fetch, START)).toBe(0);
      expect(onStarted).not.toHaveBeenCalled();
    });

    it('serverNotOnWhatsAppLandsUnderTheField', async () => {
      mockFetch({
        ...meAs(AGENT_IN_BRAND),
        [LOOKUP]: lookup(true),
        [START]: { status: 409, body: { code: 'NOT_ON_WHATSAPP', message: 'x' } },
      });
      const { user, onStarted } = renderModal();
      await user.type(await phoneBox(), '919811111111');
      await user.type(await messageBox(), 'hello');
      await user.click(sendButton());
      expect(await screen.findByText(NOT_ON)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(onStarted).not.toHaveBeenCalled();
    });

    it('Template… looks up first', async () => {
      const fetch = mockFetch({
        ...meAs(AGENT_IN_BRAND),
        [LOOKUP]: lookup(false),
        [TEMPLATES]: { status: 200, body: [welcome] },
      });
      const { user } = renderModal();
      await user.type(await phoneBox(), '919811111111');
      // Clicking straight away, without a blur first, so the click itself has to look the number up.
      fireEvent.click(templateButton());
      expect(await screen.findByText(NOT_ON)).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Send a template' })).not.toBeInTheDocument();
      expect(callsTo(fetch, TEMPLATES)).toBe(0);
      expect(callsTo(fetch, LOOKUP)).toBe(1);
    });
  });
});
