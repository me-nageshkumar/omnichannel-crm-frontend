import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatView } from '@app/api/inbox';
import { InteractiveComposer } from '@app/Inbox/InteractiveComposer';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';

const PREVIEW = 'POST /api/workspaces/w1/channel-accounts/p1/messages/preview';
const SEND = 'POST /api/workspaces/w1/inbox/chats/c1/cloud-messages';
const MEDIA = 'POST /api/workspaces/w1/channel-accounts/p1/media';

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
  adClick: null,
  otherChats: [],
};

const SENT_OK = {
  status: 200,
  body: {
    messaging_product: 'whatsapp-web',
    contacts: [{ input: '919900000001', wa_id: '919900000001' }],
    messages: [{ id: 'm9' }],
  },
};
const PREVIEW_OK = {
  status: 200,
  text: '<!doctype html><p>ok</p>',
  headers: { 'Content-Type': 'text/html;charset=UTF-8' },
};

const Host: React.FunctionComponent<{ onClose(): void; onSent(id: string): void; chat?: ChatView }> = ({
  chat,
  ...props
}) => {
  const { status } = useSession();
  return status === 'signedIn' ? <InteractiveComposer chat={chat ?? CHAT} {...props} /> : null;
};

function renderComposer(chat?: ChatView) {
  const onClose = vi.fn();
  const onSent = vi.fn();
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <SessionProvider>
        <Host onClose={onClose} onSent={onSent} chat={chat} />
      </SessionProvider>
    </ThemeProvider>,
  );
  return { user, onClose, onSent };
}

const body = () => screen.findByRole('textbox', { name: 'Body' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });
const jsonShown = () => JSON.parse(screen.getByTestId('cloud-json').textContent ?? '{}');

async function fillButtonMessage(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await body(), 'Hi');
  await user.type(screen.getByRole('textbox', { name: 'Button 1 title' }), 'Yes');
}

describe('interactive composer', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('builds and sends a reply-buttons message', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [PREVIEW]: PREVIEW_OK, [SEND]: SENT_OK });
    const { user, onSent } = renderComposer();
    await screen.findByText('Send an interactive message');
    await fillButtonMessage(user);
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    const shown = jsonShown();
    expect(shown.interactive.action.buttons[0].reply).toEqual({ id: 'yes', title: 'Yes' });
    expect(shown.messaging_product).toBe('whatsapp-web');
    await user.click(sendButton());
    await waitFor(() => expect(onSent).toHaveBeenCalledWith('m9'));
    expect(requestTo(fetch, SEND)?.body).toEqual({
      messaging_product: 'whatsapp-web',
      recipient_type: 'individual',
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Hi' },
        action: { buttons: [{ type: 'reply', reply: { id: 'yes', title: 'Yes' } }] },
      },
    });
  });

  it('previews after the debounce with the server html', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [PREVIEW]: PREVIEW_OK, [SEND]: SENT_OK });
    const { user } = renderComposer();
    await fillButtonMessage(user);
    await waitFor(() => expect(callsTo(fetch, PREVIEW)).toBeGreaterThan(0), { timeout: 2000 });
    await waitFor(() => expect(screen.getByTitle('Preview')).toHaveAttribute('srcdoc', '<!doctype html><p>ok</p>'));
    // scripts run so the list sheet can open; no allow-same-origin, so the frame cannot reach the console's token
    expect(screen.getByTitle('Preview')).toHaveAttribute('sandbox', 'allow-scripts');
    expect(requestTo(fetch, PREVIEW)?.body.interactive.body.text).toBe('Hi');
  });

  it('serverErrorLandsOnTheRightButton', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PREVIEW]: PREVIEW_OK,
      [SEND]: {
        status: 400,
        body: {
          code: 'VALIDATION',
          message: 'x',
          fields: { 'interactive.action.buttons.1.reply.title': 'must be unique' },
        },
      },
    });
    const { user } = renderComposer();
    await fillButtonMessage(user);
    await user.click(screen.getByRole('button', { name: 'Add button' }));
    await user.type(screen.getByRole('textbox', { name: 'Button 2 title' }), 'Maybe');
    await user.click(screen.getByRole('button', { name: 'Add button' }));
    await user.type(screen.getByRole('textbox', { name: 'Button 3 title' }), 'No');
    await user.click(screen.getByRole('button', { name: 'Remove button 2' }));
    expect(screen.getByRole('textbox', { name: 'Button 2 title' })).toHaveValue('No');
    expect(screen.queryByRole('textbox', { name: 'Button 3 title' })).not.toBeInTheDocument();
    await user.click(sendButton());
    const field = await screen.findByRole('textbox', { name: 'Button 2 title' });
    const group = field.closest('.pf-v6-c-form__group') as HTMLElement;
    expect(within(group).getByText('must be unique')).toBeInTheDocument();
  });

  it('sendIsSingleFlight', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PREVIEW]: PREVIEW_OK,
      [SEND]: new Response(JSON.stringify(SENT_OK.body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });
    const { user, onSent } = renderComposer();
    await fillButtonMessage(user);
    const button = sendButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(callsTo(fetch, SEND)).toBe(1);
  });

  it('uploads a header image and puts its id in the message', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PREVIEW]: PREVIEW_OK,
      [MEDIA]: { status: 200, body: { id: 'img1' } },
    });
    const { user } = renderComposer();
    await body();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Header' }), 'image');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dropzone = input.parentElement as HTMLElement;
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file], types: ['Files'] } });
    await waitFor(() => expect(callsTo(fetch, MEDIA)).toBe(1));
    await screen.findByDisplayValue('a.png');
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    expect(jsonShown().interactive.header).toEqual({ type: 'image', image: { id: 'img1' } });
  });

  it('uploadsWithTheCloudProductOnACloudChat', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PREVIEW]: PREVIEW_OK,
      [MEDIA]: { status: 200, body: { id: 'img1' } },
    });
    const { user } = renderComposer({ ...CHAT, channel: 'WHATSAPP_CLOUD' });
    await body();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Header' }), 'image');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' });
    fireEvent.drop(input.parentElement as HTMLElement, { dataTransfer: { files: [file], types: ['Files'] } });
    await waitFor(() => expect(callsTo(fetch, MEDIA)).toBe(1));
    const sent = fetch.mock.calls.find(([u]) => String(u).endsWith('/media'))?.[1]?.body as FormData;
    expect(sent.get('messaging_product')).toBe('whatsapp');
  });

  it('switching kind to list changes the form and the JSON', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [PREVIEW]: PREVIEW_OK });
    const { user } = renderComposer();
    await body();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Message kind' }), 'list');
    expect(screen.queryByRole('textbox', { name: 'Button 1 title' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'List button label' }), 'Options');
    await user.type(screen.getByRole('textbox', { name: 'Section 1 title' }), 'Fast');
    await user.type(screen.getByRole('textbox', { name: 'Section 1 row 1 title' }), 'Overnight');
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    expect(jsonShown().interactive.action).toEqual({
      button: 'Options',
      sections: [{ title: 'Fast', rows: [{ id: 'overnight', title: 'Overnight' }] }],
    });
  });

  it('an unmapped server key shows a form-level alert', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PREVIEW]: PREVIEW_OK,
      [SEND]: {
        status: 400,
        body: {
          code: 'VALIDATION',
          message: 'interactive.header.type must be text',
          fields: { 'interactive.header.type': 'must be text' },
        },
      },
    });
    const { user, onSent } = renderComposer();
    await fillButtonMessage(user);
    await user.click(sendButton());
    expect(await screen.findByText('interactive.header.type must be text')).toBeInTheDocument();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('a kind switch during an upload does not resurrect the media header', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    const slow = new Response(
      new ReadableStream<Uint8Array>({
        start: (c) => {
          controller = c;
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [PREVIEW]: PREVIEW_OK, [MEDIA]: slow });
    const { user } = renderComposer();
    await body();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Header' }), 'image');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.drop(input.parentElement as HTMLElement, {
      dataTransfer: {
        files: [new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' })],
        types: ['Files'],
      },
    });
    await waitFor(() => expect(callsTo(fetch, MEDIA)).toBe(1));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Message kind' }), 'list');
    // the upload now finishes, after the header it was for is gone
    (controller as ReadableStreamDefaultController<Uint8Array> | null)?.enqueue(
      new TextEncoder().encode(JSON.stringify({ id: 'img1' })),
    );
    (controller as ReadableStreamDefaultController<Uint8Array> | null)?.close();
    await new Promise((r) => setTimeout(r, 50));
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    expect(jsonShown().interactive).not.toHaveProperty('header');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Message kind' }), 'button');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Header' }), 'image');
    expect(screen.queryByDisplayValue('a.png')).not.toBeInTheDocument();
  });

  it('the spinner stops when the form turns incomplete mid-debounce', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [PREVIEW]: PREVIEW_OK });
    const { user } = renderComposer();
    await fillButtonMessage(user);
    await user.clear(screen.getByRole('textbox', { name: 'Button 1 title' }));
    expect(screen.queryByLabelText('Rendering the preview')).not.toBeInTheDocument();
    expect(screen.getByText('Fill in the message to see how it will look')).toBeInTheDocument();
  });

  it('a preview failure clears once a later preview succeeds', async () => {
    let calls = 0;
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PREVIEW]: () => (++calls === 1 ? { status: 500, body: { code: 'OOPS', message: 'boom' } } : PREVIEW_OK),
    });
    const { user } = renderComposer();
    await fillButtonMessage(user);
    await screen.findByRole('heading', { name: /boom|went wrong|error/i }, { timeout: 2000 }).catch(() => undefined);
    const alerts = () => document.querySelectorAll('.pf-v6-c-alert.pf-m-danger').length;
    await waitFor(() => expect(alerts()).toBe(1), { timeout: 2000 });
    await user.type(screen.getByRole('textbox', { name: 'Body' }), '!');
    await waitFor(() => expect(screen.getByTitle('Preview')).toHaveAttribute('srcdoc', '<!doctype html><p>ok</p>'), {
      timeout: 2000,
    });
    expect(alerts()).toBe(0);
  });

  it('disables Send until required fields are filled', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [PREVIEW]: PREVIEW_OK });
    const { user } = renderComposer();
    await body();
    expect(sendButton()).toBeDisabled();
    await fillButtonMessage(user);
    expect(sendButton()).toBeEnabled();
  });

  it('says in a full sentence that the wallet is too low', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PREVIEW]: PREVIEW_OK,
      [SEND]: { status: 402, body: { code: 'WALLET_EMPTY', message: 'The wallet balance is too low to send' } },
    });
    const { user, onSent } = renderComposer();
    await screen.findByText('Send an interactive message');
    await fillButtonMessage(user);
    await user.click(sendButton());
    expect(await screen.findByText('The wallet balance is too low to send.')).toBeVisible();
    expect(onSent).not.toHaveBeenCalled();
  });
});
