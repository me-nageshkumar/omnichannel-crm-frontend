import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TestContact } from '@app/api/automations';
import { TestDialog } from '@app/Chatbots/editor/TestDialog';
import { SessionProvider } from '@app/session/SessionContext';
import { CHATBOTS_BASE, LEAD_QUALIFIER, RUN_WAITING } from '../../../test/chatbots';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import type { MockRoute } from '../../../test/fetchMock';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';

const CONTACTS = '/api/workspaces/w1/automations/test-contacts';
const TEST = `${CHATBOTS_BASE}/c1/test`;
const VEENU: TestContact = {
  contactId: 'k1',
  name: 'Veenu',
  phone: '919799750743',
  numbers: [
    { id: 'n1', number: '919928088743', label: 'Main line' },
    { id: 'n2', number: '919928088744', label: 'Sales line' },
  ],
};

function inTurn(...responses: { status: number; body?: unknown }[]): MockRoute {
  let n = 0;
  return () => responses[Math.min(n++, responses.length - 1)];
}

function open(routes: Record<string, MockRoute>, props: Partial<React.ComponentProps<typeof TestDialog>> = {}) {
  cleanup();
  const f = mockFetch({ ...meAs(WORKSPACE_MANAGER), [`GET ${CONTACTS}`]: { status: 200, body: [VEENU] }, ...routes });
  const onStarted = vi.fn();
  render(
    <SessionProvider>
      <TestDialog
        chatbot={LEAD_QUALIFIER}
        canStart
        dirty={false}
        onStarted={onStarted}
        onClose={() => undefined}
        {...props}
      />
    </SessionProvider>,
  );
  return { f, onStarted, user: userEvent.setup() };
}

async function pickVeenu(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Search contacts' }), 'vee');
  await user.click(await screen.findByRole('radio', { name: /Veenu/ }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Number' }), 'n1');
}

describe('TestDialog', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.restoreAllMocks());

  it('startsTestWithContactAndNumber', async () => {
    const { f, onStarted, user } = open({ [`POST ${TEST}`]: { status: 200, body: RUN_WAITING } });
    expect(screen.getByText('Messages really go to this contact.')).toBeVisible();
    await pickVeenu(user);
    await user.click(screen.getByRole('button', { name: 'Start test' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(RUN_WAITING));
    expect(requestTo(f, `POST ${TEST}`)?.body).toEqual({ contactId: 'k1', phoneNumberId: 'n1' });
  });

  it('runningConflictOffersStopAndStart', async () => {
    const { f, onStarted, user } = open({
      [`POST ${TEST}`]: inTurn(
        { status: 409, body: { code: 'CHATBOT_RUNNING', message: 'running', chatbotName: 'Price bot' } },
        { status: 200, body: RUN_WAITING },
      ),
    });
    await pickVeenu(user);
    await user.click(screen.getByRole('button', { name: 'Start test' }));
    expect(await screen.findByText('Chatbot “Price bot” is running on this chat')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Stop it and start the test' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(RUN_WAITING));
    expect(callsTo(f, `POST ${TEST}`)).toBe(2);
    expect(requestTo(f, `POST ${TEST}`, 1)?.body).toMatchObject({ contactId: 'k1', stopRunning: true });
  });

  it('disabledWhenErrorsOrDirty', async () => {
    const { user } = open({}, { canStart: false });
    await pickVeenu(user);
    expect(screen.getByRole('button', { name: 'Start test' })).toBeDisabled();
    expect(screen.getByText('Fix the problems first')).toBeVisible();
    const { user: u2 } = open({}, { dirty: true });
    await pickVeenu(u2);
    expect(screen.getByRole('button', { name: 'Start test' })).toBeDisabled();
    expect(screen.getByText('Save first')).toBeVisible();
  });
});
