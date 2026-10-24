import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, crmStatus, samplePipeline } from '../../../test/crm';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { nextLaneColor } from './laneColors';

const BASE = '/api/workspaces/w1/crm';
const STAGES = `PUT ${BASE}/pipelines/p1/stages`;
const SALES = samplePipeline();

function routes(extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}/status`]: { status: 200, body: crmStatus({ authorities: ['crm:view', 'crm:settings'] }) },
    [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
    [`GET ${BASE}/pipelines`]: { status: 200, body: [SALES] },
    [`GET ${BASE}/pipelines/p1`]: { status: 200, body: SALES },
    ...extra,
  };
}

async function openEditor(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('tab', { name: 'Pipelines' }));
  await user.click(await screen.findByRole('button', { name: 'Actions for Sales' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  return screen.findByRole('dialog', { name: 'Edit pipeline' });
}

const laneNames = () => screen.getAllByLabelText('Lane name').map((e) => (e as HTMLInputElement).value);

describe('stage editor', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    // jsdom has no layout; give each lane row a box so keyboard sorting can tell above from below.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const i = Number((this as HTMLElement).dataset?.laneIndex ?? NaN);
      const top = Number.isNaN(i) ? 0 : i * 100;
      const height = Number.isNaN(i) ? 0 : 100;
      return { top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('addLaneAppendsOpenStage', async () => {
    const f = mockFetch(routes({ [STAGES]: ({ body }: { body: object }) => ({ status: 200, body }) }));
    const { user } = renderApp('/crm/settings');
    const dialog = await openEditor(user);
    expect(laneNames()).toEqual(['New', 'Proposal', 'Won']);
    await user.click(within(dialog).getByRole('button', { name: 'Add lane' }));
    expect(laneNames()).toEqual(['New', 'Proposal', 'Won', '']);
    const last = screen.getAllByLabelText('Lane name')[3];
    expect(screen.getAllByLabelText('Lane type')[3]).toHaveValue('OPEN');
    await user.type(last, 'Qualified');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(f, STAGES)).toBeDefined());
    const sent = requestTo(f, STAGES)?.body;
    expect(sent.version).toBe(3);
    expect(sent.stages.map((s: { name: string }) => s.name)).toEqual(['New', 'Proposal', 'Won', 'Qualified']);
    expect(sent.stages[3]).toEqual({
      name: 'Qualified',
      type: 'OPEN',
      color: nextLaneColor(3),
      probability: 0,
      wipLimit: null,
    });
    expect(sent.stages[0].id).toBe('s1');
    expect(callsTo(f, `PUT ${BASE}/pipelines/p1`)).toBe(0);
  });

  it('keyboardReorderMovesRow', async () => {
    const f = mockFetch(routes({ [STAGES]: ({ body }: { body: object }) => ({ status: 200, body }) }));
    const { user } = renderApp('/crm/settings');
    const dialog = await openEditor(user);
    const handle = within(dialog).getByRole('button', { name: /Reorder lane New/ });
    handle.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    await waitFor(() => expect(laneNames()).toEqual(['Proposal', 'New', 'Won']));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(f, STAGES)).toBeDefined());
    expect(requestTo(f, STAGES)?.body.stages.map((s: { id: string }) => s.id)).toEqual(['s2', 's1', 's3']);
  });

  it('removingLaneWithDealsAsksWhereToMove', async () => {
    const put = vi
      .fn()
      .mockReturnValueOnce({
        status: 409,
        body: { code: 'STAGE_HAS_DEALS', message: 'x', stageId: 's2', count: '4' },
      })
      .mockImplementation(() => ({ status: 200, body: SALES }));
    const f = mockFetch(routes({ [STAGES]: () => put() }));
    const { user } = renderApp('/crm/settings');
    const dialog = await openEditor(user);
    await user.click(within(dialog).getByRole('button', { name: 'Remove lane Proposal' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const ask = await screen.findByRole('dialog', { name: /Move deals before removing/ });
    expect(within(ask).getByText(/Proposal/)).toBeInTheDocument();
    expect(within(ask).getByText(/4 deals/)).toBeInTheDocument();
    const go = within(ask).getByRole('button', { name: 'Move deals and save' });
    expect(go).toBeDisabled();
    // The removed lane is not its own target.
    expect(within(ask).queryByRole('option', { name: 'Proposal' })).toBeNull();
    await user.selectOptions(within(ask).getByLabelText('Move deals to'), 'New');
    await user.click(go);

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    const first = requestTo(f, STAGES, 0)?.body.stages;
    const second = requestTo(f, STAGES, 1)?.body.stages;
    expect(first.map((s: { id: string }) => s.id)).toEqual(['s1', 's3']);
    expect(second.find((s: { id: string }) => s.id === 's2').moveToStageId).toBe('s1');
    expect(second.filter((s: { id: string }) => s.id !== 's2').every((s: object) => !('moveToStageId' in s))).toBe(
      true,
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit pipeline' })).toBeNull());
  });

  it('typeChangeWithDealsShowsInlineAlert', async () => {
    mockFetch(
      routes({
        [STAGES]: { status: 409, body: { code: 'STAGE_TYPE_HAS_DEALS', message: 'x', stageId: 's2', count: '4' } },
      }),
    );
    const { user } = renderApp('/crm/settings');
    const dialog = await openEditor(user);
    await user.selectOptions(screen.getAllByLabelText('Lane type')[1], 'LOST');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText("This lane still holds deals, so its type can't change.")).toBeVisible();
  });

  it('stageSaveConflictOffersReload', async () => {
    const reloaded = samplePipeline({ version: 4, stages: SALES.stages.slice(0, 2) });
    const get = vi
      .fn()
      .mockReturnValueOnce({ status: 200, body: SALES })
      .mockReturnValue({ status: 200, body: reloaded });
    const f = mockFetch(
      routes({
        [STAGES]: { status: 409, body: { code: 'VERSION_CONFLICT', message: 'x' } },
        [`GET ${BASE}/pipelines/p1`]: () => get(),
      }),
    );
    const { user } = renderApp('/crm/settings');
    const dialog = await openEditor(user);
    await user.click(within(dialog).getByRole('button', { name: 'Add lane' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Someone else changed this. Reload to see their changes.')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(laneNames()).toEqual(['New', 'Proposal']));
    expect(callsTo(f, `GET ${BASE}/pipelines/p1`)).toBe(2);
    expect(within(dialog).queryByText('Someone else changed this. Reload to see their changes.')).toBeNull();
  });
});
