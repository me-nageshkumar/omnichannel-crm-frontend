import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { callsTo, mockFetch } from '../../../test/fetchMock';
import { crmStatus } from '../../../test/crm';
import { AGENT_IN_BRAND, BRAND_A, BRAND_B, CUSTOMER_ADMIN, meAs, storeSession } from '../../../test/session';

const loaded = vi.hoisted(() => ({ pipelines: 0 }));
vi.mock('@app/Crm/Pipelines/PipelinesPage', () => {
  loaded.pipelines += 1;
  return { PipelinesPage: () => <h1>Pipelines page</h1> };
});

/**
 * The modules are loaded afresh for every test, so the mocked page module's factory (which counts imports) and
 * React.lazy's cache start empty each time; the counter is then independent of test order.
 */
const fresh = async () => ({
  ...(await import('../../../test/renderApp')),
  ...(await import('@app/session/SessionContext')),
});

const STATUS_W1 = 'GET /api/workspaces/w1/crm/status';
const crmCalls = (f: ReturnType<typeof mockFetch>) =>
  f.mock.calls.filter(([url]) => String(url).includes('/crm/')).length;
const nav = (): HTMLElement => document.getElementById('nav-primary') as HTMLElement;

describe('CRM status gate', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    loaded.pipelines = 0;
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('navShowsCrmGroupWhenEnabled', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [STATUS_W1]: { status: 200, body: crmStatus() } });
    const { renderApp } = await fresh();
    renderApp('/');
    await screen.findByRole('link', { name: 'Pipelines', hidden: true });
    const links = within(nav())
      .getAllByRole('link', { hidden: true })
      .map((l) => l.textContent);
    expect(links).toEqual(expect.arrayContaining(['Pipelines', 'Contacts', 'Companies']));
    expect(within(nav()).getAllByText('CRM', { exact: true, ignore: 'title' }).length).toBeGreaterThan(0);
  });

  it('navHidesCrmWhenDisabled', async () => {
    const f = mockFetch({ ...meAs(AGENT_IN_BRAND), [STATUS_W1]: { status: 200, body: crmStatus({ enabled: false }) } });
    const { renderApp } = await fresh();
    renderApp('/crm');
    expect(await screen.findByText('CRM is not switched on for this brand')).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, STATUS_W1)).toBe(1));
    expect(screen.queryByRole('link', { name: 'Pipelines', hidden: true })).toBeNull();
    expect(crmCalls(f)).toBe(1);
    expect(loaded.pipelines).toBe(0);
  });

  it('noStatusCallWithoutCrmView', async () => {
    const user = { ...AGENT_IN_BRAND, workspaces: [{ ...BRAND_A, authorities: ['inbox:view'] }] };
    const f = mockFetch(meAs(user));
    const { renderApp } = await fresh();
    renderApp('/');
    await screen.findByRole('link', { name: 'Dashboard', hidden: true });
    expect(crmCalls(f)).toBe(0);
    expect(screen.queryByRole('link', { name: 'Pipelines', hidden: true })).toBeNull();
  });

  it('directLinkWhenOffShowsOffState', async () => {
    const f = mockFetch({ ...meAs(AGENT_IN_BRAND), [STATUS_W1]: { status: 200, body: crmStatus({ enabled: false }) } });
    const { renderApp } = await fresh();
    renderApp('/crm');
    expect(await screen.findByText('CRM is not switched on for this brand')).toBeInTheDocument();
    expect(screen.getByText('Ask your account manager to switch it on.')).toBeInTheDocument();
    expect(crmCalls(f)).toBe(1);
    expect(loaded.pipelines).toBe(0);
  });

  it('directLinkWhenOnLoadsThePage', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [STATUS_W1]: { status: 200, body: crmStatus() } });
    const { renderApp } = await fresh();
    renderApp('/crm');
    expect(await screen.findByRole('heading', { name: 'Pipelines page' })).toBeInTheDocument();
    expect(loaded.pipelines).toBe(1);
  });

  it('brandSwitchReloadsStatus', async () => {
    const f = mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      [STATUS_W1]: { status: 200, body: crmStatus() },
      'GET /api/workspaces/w2/crm/status': { status: 200, body: crmStatus({ enabled: false }) },
    });
    let select: (id: string) => void = () => undefined;
    const { renderApp, useSession } = await fresh();
    const Probe = (): null => {
      select = useSession().selectWorkspace;
      return null;
    };
    renderApp('/', <Probe />);
    await screen.findByRole('link', { name: 'Pipelines', hidden: true });
    act(() => select(BRAND_B.id));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Pipelines', hidden: true })).toBeNull());
    expect(callsTo(f, 'GET /api/workspaces/w2/crm/status')).toBe(1);
    expect(callsTo(f, STATUS_W1)).toBe(1);
  });

  it('failedStatusShowsRetryNotOffCopy', async () => {
    let answer = { status: 500, body: { error: 'boom' } } as { status: number; body: unknown };
    mockFetch({ ...meAs(AGENT_IN_BRAND), [STATUS_W1]: () => answer });
    const { renderApp } = await fresh();
    renderApp('/crm');
    expect(await screen.findByText("Couldn't check whether the CRM is on")).toBeInTheDocument();
    expect(screen.queryByText('CRM is not switched on for this brand')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Pipelines', hidden: true })).toBeNull();
    answer = { status: 200, body: crmStatus() };
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Pipelines page' })).toBeInTheDocument();
  });

  it('brandSwitchOnCrmPageShowsNewBrandState', async () => {
    const f = mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      [STATUS_W1]: { status: 200, body: crmStatus() },
      'GET /api/workspaces/w2/crm/status': { status: 200, body: crmStatus({ enabled: false }) },
    });
    let select: (id: string) => void = () => undefined;
    const { renderApp, useSession } = await fresh();
    const Probe = (): null => {
      select = useSession().selectWorkspace;
      return null;
    };
    renderApp('/crm', <Probe />);
    expect(await screen.findByRole('heading', { name: 'Pipelines page' })).toBeInTheDocument();
    act(() => select(BRAND_B.id));
    expect(await screen.findByText('CRM is not switched on for this brand')).toBeInTheDocument();
    expect(callsTo(f, 'GET /api/workspaces/w2/crm/status')).toBe(1);
  });
});
