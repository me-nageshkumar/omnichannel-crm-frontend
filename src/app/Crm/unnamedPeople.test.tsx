import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { crmSettings, sampleBoard, sampleDeal, samplePipeline, sampleTask } from '../../test/crm';
import { BASE, boardRoutes } from '../../test/crmBoard';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { DealFormModal } from '@app/Crm/deals/DealFormModal';
import { SessionProvider } from '@app/session/SessionContext';

// The server sends a person's name as null when it can't name them: a removed user, or the system actor.
const NOBODY = { id: 'system', name: null };

describe('people without a name', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('boardRendersDealOwnedByUnnamedPerson', async () => {
    const board = sampleBoard();
    board.lanes[0].deals = [sampleDeal({ owner: NOBODY })];
    mockFetch(boardRoutes({ [`GET ${BASE}/deals/board`]: { status: 200, body: board } }));
    renderApp('/crm');
    expect(await screen.findByText('Acme order')).toBeInTheDocument();
    expect(screen.getByLabelText('Owner System')).toBeInTheDocument();
  });

  it('dealFormOpensForUnnamedOwner', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), [`GET ${BASE}/fields`]: { status: 200, body: [] } });
    render(
      <MemoryRouter>
        <SessionProvider>
          <DealFormModal
            deal={sampleDeal({ owner: NOBODY })}
            pipeline={samplePipeline()}
            settings={crmSettings()}
            owners={[NOBODY, { id: 'o1', name: 'Asha Rao' }]}
            onSaved={() => undefined}
            onClose={() => undefined}
          />
        </SessionProvider>
      </MemoryRouter>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    expect(within(dialog).getByRole('option', { name: 'System' })).toBeInTheDocument();
  });

  it('tasksPageShowsUnnamedAssignee', async () => {
    mockFetch(
      boardRoutes(
        {
          [`GET ${BASE}/tasks/mine`]: { status: 200, body: [sampleTask({ assignee: NOBODY })] },
          [`GET ${BASE}/tasks/mine/counts`]: { status: 200, body: { overdue: 0, today: 1, upcoming: 0 } },
        },
        { authorities: ['crm:view', 'crm:edit', 'crm:view-all'] },
      ),
    );
    renderApp('/crm/tasks');
    expect(await screen.findByText('Call back')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Assignee')).getByRole('option', { name: 'System' })).toBeInTheDocument();
  });
});
