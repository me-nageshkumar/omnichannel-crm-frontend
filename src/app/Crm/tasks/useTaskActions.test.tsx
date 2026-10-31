import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { mockFetch } from '../../../test/fetchMock';
import { sampleTask } from '../../../test/crm';
import { BASE } from '../../../test/crmBoard';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { useTaskActions } from '@app/Crm/tasks/useTaskActions';

const one = sampleTask({ id: 't1', title: 'One', status: 'OPEN' });
const two = sampleTask({ id: 't2', title: 'Two', status: 'OPEN' });

const Harness: React.FunctionComponent<{ onRemoved(id: string): void }> = ({ onRemoved }) => {
  const { token } = useSession();
  const actions = useTaskActions(() => undefined, onRemoved);
  if (!token) return null;
  return (
    <>
      <button onClick={() => void actions.toggle(one)}>Finish one</button>
      <button onClick={() => void actions.toggle(two)}>Finish two</button>
      <button onClick={() => actions.remove(one)}>Remove one</button>
      <p aria-label="error">{actions.error ?? 'none'}</p>
      {actions.dialogs}
    </>
  );
};

function setup(routes: Record<string, unknown>) {
  mockFetch({ ...meAs(WORKSPACE_MANAGER), ...(routes as Record<string, never>) });
  const onRemoved = vi.fn();
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <SessionProvider>
        <Harness onRemoved={onRemoved} />
      </SessionProvider>
    </MemoryRouter>,
  );
  return { user, onRemoved };
}

describe('useTaskActions', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('anActionOnOneTaskKeepsTheErrorOfAnother', async () => {
    const { user } = setup({
      [`POST ${BASE}/tasks/t1/complete`]: { status: 500, body: {} },
      [`POST ${BASE}/tasks/t2/complete`]: { status: 200, body: { ...two, status: 'DONE' } },
    });
    await user.click(await screen.findByRole('button', { name: 'Finish one' }));
    await waitFor(() => expect(screen.getByLabelText('error')).toHaveTextContent('Could not update the task'));
    await user.click(screen.getByRole('button', { name: 'Finish two' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish two' })).toBeEnabled());
    expect(screen.getByLabelText('error')).toHaveTextContent('Could not update the task');
  });

  it('tryingATaskAgainClearsItsOwnError', async () => {
    let tries = 0;
    const { user } = setup({
      [`POST ${BASE}/tasks/t1/complete`]: () =>
        tries++ === 0 ? { status: 500, body: {} } : { status: 200, body: { ...one, status: 'DONE' } },
    });
    await user.click(await screen.findByRole('button', { name: 'Finish one' }));
    await waitFor(() => expect(screen.getByLabelText('error')).toHaveTextContent('Could not update the task'));
    await user.click(screen.getByRole('button', { name: 'Finish one' }));
    await waitFor(() => expect(screen.getByLabelText('error')).toHaveTextContent('none'));
  });

  it('deletingATaskThatIsAlreadyGoneRemovesItsRow', async () => {
    const { user, onRemoved } = setup({
      [`DELETE ${BASE}/tasks/t1`]: { status: 404, body: { code: 'NOT_FOUND', message: 'Task not found' } },
    });
    await user.click(await screen.findByRole('button', { name: 'Remove one' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull());
  });

  it('aDeleteThatFailsOtherwiseStaysInItsDialog', async () => {
    const { user, onRemoved } = setup({ [`DELETE ${BASE}/tasks/t1`]: { status: 500, body: {} } });
    await user.click(await screen.findByRole('button', { name: 'Remove one' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Could not delete the task. Try again.')).toBeInTheDocument();
    expect(onRemoved).not.toHaveBeenCalled();
  });
});
