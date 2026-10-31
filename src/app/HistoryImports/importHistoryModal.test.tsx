import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatView } from '@app/api/inbox';
import type { HistoryImportView } from '@app/api/historyImports';
import type { PhoneNumber } from '@app/api/phoneNumbers';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';
import { ImportHistoryModal } from './ImportHistoryModal';

const NUMBER_PATH = 'POST /api/workspaces/w1/inbox/phone-numbers/p1/history-imports';
const CHAT_PATH = 'POST /api/workspaces/w1/inbox/chats/c1/history-imports';

const NUMBER = { id: 'p1', number: '919928088743', label: null } as PhoneNumber;
const CHAT = {
  id: 'c1',
  contact: { id: 'ct1', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
} as ChatView;
const VIEW = { id: 'imp1', status: 'QUEUED' } as HistoryImportView;

type Target = React.ComponentProps<typeof ImportHistoryModal>['target'];

const Host: React.FunctionComponent<{ target: Target; onStarted(v: HistoryImportView): void }> = (p) => {
  const { status } = useSession();
  return status === 'signedIn' ? (
    <ImportHistoryModal target={p.target} onStarted={p.onStarted} onCancel={() => undefined} />
  ) : null;
};

function open(target: Target, routes: Parameters<typeof mockFetch>[0] = {}) {
  const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), ...routes });
  const onStarted = vi.fn();
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <SessionProvider>
        <Host target={target} onStarted={onStarted} />
      </SessionProvider>
    </ThemeProvider>,
  );
  return { fetch, onStarted, user };
}

describe('ImportHistoryModal', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });

  it('startsAllChatsImport', async () => {
    const { fetch, onStarted, user } = open(
      { kind: 'number', number: NUMBER },
      { [NUMBER_PATH]: { status: 201, body: VIEW } },
    );
    expect(await screen.findByText('Import chat history for +919928088743')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All chats' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Start import' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(VIEW));
    expect(requestTo(fetch, NUMBER_PATH)?.body).toEqual({ scope: { kind: 'ALL' }, from: null, to: null });
  });

  it('specificContactsRequiresPhones', async () => {
    const { fetch, user } = open({ kind: 'number', number: NUMBER });
    await user.click(await screen.findByRole('radio', { name: 'Specific contacts' }));
    expect(screen.getByLabelText('Phone numbers')).toHaveAttribute(
      'placeholder',
      'One number per line, country code first',
    );
    await user.click(screen.getByRole('button', { name: 'Start import' }));
    expect(await screen.findByText('Enter at least one phone number.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Phone numbers'), '12345');
    await user.click(screen.getByRole('button', { name: 'Start import' }));
    expect(await screen.findByText('Use 8 to 15 digits, country code first: 12345')).toBeInTheDocument();
    expect(callsTo(fetch, NUMBER_PATH)).toBe(0);
  });

  it('sendsSpecificContactsAndDates', async () => {
    const { fetch, user } = open({ kind: 'number', number: NUMBER }, { [NUMBER_PATH]: { status: 201, body: VIEW } });
    await user.click(await screen.findByRole('radio', { name: 'Specific contacts' }));
    await user.type(screen.getByLabelText('Phone numbers'), '+91 99280-88744');
    await user.type(screen.getByLabelText('From'), '2026-03-05');
    await user.type(screen.getByLabelText('To'), '2026-03-06');
    await user.click(screen.getByRole('button', { name: 'Start import' }));
    await waitFor(() => expect(callsTo(fetch, NUMBER_PATH)).toBe(1));
    const body = requestTo(fetch, NUMBER_PATH)?.body;
    expect(body.scope).toEqual({ kind: 'CHATS', phones: ['919928088744'] });
    expect(body.from).toBe(new Date(2026, 2, 5, 0, 0, 0, 0).toISOString());
    expect(body.to).toBe(new Date(2026, 2, 6, 23, 59, 59, 999).toISOString());
  });

  it('fromAfterToIsRefused', async () => {
    const { fetch, user } = open({ kind: 'number', number: NUMBER });
    await user.type(await screen.findByLabelText('From'), '2026-03-06');
    await user.type(screen.getByLabelText('To'), '2026-03-05');
    await user.click(screen.getByRole('button', { name: 'Start import' }));
    expect(await screen.findByText('"From" must not be after "To".')).toBeInTheDocument();
    expect(callsTo(fetch, NUMBER_PATH)).toBe(0);
  });

  it('malformedDateIsRefused', async () => {
    const { fetch, user } = open({ kind: 'number', number: NUMBER });
    await user.type(await screen.findByLabelText('From'), '2026-13-45');
    await user.click(screen.getByRole('button', { name: 'Start import' }));
    expect(await screen.findByText('Enter a date as YYYY-MM-DD.')).toBeInTheDocument();
    expect(callsTo(fetch, NUMBER_PATH)).toBe(0);
  });

  it('chatModeShowsOnlyDates', async () => {
    const { fetch, onStarted, user } = open({ kind: 'chat', chat: CHAT }, { [CHAT_PATH]: { status: 201, body: VIEW } });
    expect(await screen.findByText('Import chat history with Asha Rao')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start import' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(VIEW));
    expect(requestTo(fetch, CHAT_PATH)?.body).toEqual({ from: null, to: null });
  });
});
