import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, TEAM_LEAD, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { rowWith } from '../../test/admin';
import { contact, label, savedFilter } from '../../test/contacts';
import type { CurrentUser } from '@app/api/users';

const B = '/api/workspaces/w1';
const IMPORT = `POST ${B}/contacts/import`;
const EXPORT = `POST ${B}/contacts/export`;
const ASHA = contact({ id: 'c1', name: 'Asha Rao', phone: '919900000001' });
const SAVED = savedFilter({ id: 'f1', name: 'Jaipur VIPs', filter: { labelsAny: ['l1'] } });
const CSV = {
  status: 200,
  text: 'phone,name\n919900000001,Asha Rao\n',
  headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="contacts-brand-a-20261020.csv"',
  },
};

function routes(user: CurrentUser = WORKSPACE_MANAGER, extra = {}) {
  return {
    ...meAs(user),
    [`POST ${B}/contacts/search`]: { status: 200, body: { items: [ASHA], total: 1, page: 0 } },
    [`GET ${B}/contact-labels`]: { status: 200, body: [label({ id: 'l1', name: 'VIP' })] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [] },
    [`GET ${B}/contact-filters`]: { status: 200, body: [SAVED] },
    ...extra,
  };
}

const csvFile = () => new File(['phone,name\n919900000009,New\n'], 'people.csv', { type: 'text/csv' });
async function uploadAndImport(user: ReturnType<typeof renderApp>['user']) {
  await rowWith('Asha Rao');
  await user.click(screen.getByRole('button', { name: 'Import' }));
  const dialog = await screen.findByRole('dialog');
  await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, csvFile());
  await user.click(within(dialog).getByRole('button', { name: 'Import' }));
  return dialog;
}

describe('contact import and export', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('importShowsSummary', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [IMPORT]: {
          status: 200,
          body: {
            created: 3,
            updated: 2,
            unchanged: 1,
            skipped: 0,
            problems: [],
            unknownColumns: [],
            unknownLabels: [],
          },
        },
      }),
    );
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(
      await screen.findByText(
        'CSV with a header row. phone is required (country code first); name, labels (separated by ;) and columns named after your attributes are optional.',
      ),
    ).toBeVisible();
    await user.keyboard('{Escape}');
    const dialog = await uploadAndImport(user);
    expect(await within(dialog).findByText('3 created')).toBeVisible();
    expect(within(dialog).getByText('2 updated')).toBeVisible();
    expect(within(dialog).getByText('1 unchanged')).toBeVisible();
    expect(within(dialog).getByText('0 skipped')).toBeVisible();
    const sent = fetch.mock.calls.find(([, init]) => init?.body instanceof FormData)?.[1]?.body as FormData;
    expect((sent.get('file') as File).name).toBe('people.csv');
    expect(callsTo(fetch, IMPORT)).toBe(1);
  });

  it('importProblemsListed', async () => {
    mockFetch(
      routes(WORKSPACE_MANAGER, {
        [IMPORT]: {
          status: 200,
          body: {
            created: 1,
            updated: 0,
            unchanged: 0,
            skipped: 2,
            problems: [
              { row: 4, reason: 'Invalid phone' },
              { row: 7, reason: 'Missing phone' },
            ],
            unknownColumns: ['nickname'],
            unknownLabels: ['Gold'],
          },
        },
      }),
    );
    const { user } = renderApp('/contacts');
    const dialog = await uploadAndImport(user);
    expect(await within(dialog).findByText('2 skipped')).toBeVisible();
    expect(within(dialog).getByText('Row 4: Invalid phone')).toBeVisible();
    expect(within(dialog).getByText('Row 7: Missing phone')).toBeVisible();
    expect(within(dialog).getByText('Ignored columns: nickname')).toBeVisible();
    expect(within(dialog).getByText('Ignored labels: Gold')).toBeVisible();
  });

  it('importErrorShowsMessage', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, { [IMPORT]: { status: 403, body: { code: 'FORBIDDEN' } } }));
    const { user } = renderApp('/contacts');
    const dialog = await uploadAndImport(user);
    expect(await within(dialog).findByText("You don't have permission to do that.")).toBeVisible();
  });

  it('exportDownloads', async () => {
    const created = vi.fn(() => 'blob:csv');
    const revoked = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked }));
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    const fetch = mockFetch(routes(WORKSPACE_MANAGER, { [EXPORT]: CSV }));
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].download).toBe('contacts-brand-a-20261020.csv');
    expect(clicked[0].href).toBe('blob:csv');
    expect(requestTo(fetch, EXPORT)?.body).toEqual({ filter: {} });
    expect(created).toHaveBeenCalledTimes(1);
    expect(revoked).toHaveBeenCalledWith('blob:csv');
  });

  it('exportUsesSavedFilter', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:csv', revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const fetch = mockFetch(routes(WORKSPACE_MANAGER, { [EXPORT]: CSV }));
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Saved filter: None' }));
    await user.click(await screen.findByRole('option', { name: 'Jaipur VIPs' }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(callsTo(fetch, EXPORT)).toBe(1));
    expect(requestTo(fetch, EXPORT)?.body).toEqual({ filterId: 'f1' });
  });

  it('exportTooManyRowsShowsMessage', async () => {
    const created = vi.fn(() => 'blob:csv');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    mockFetch(routes(WORKSPACE_MANAGER, { [EXPORT]: { status: 400, body: { code: 'TOO_MANY_ROWS' } } }));
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(
      await screen.findByText('Too many contacts to export (the limit is 100,000). Narrow the filter and try again.'),
    ).toBeVisible();
    expect(created).not.toHaveBeenCalled();
  });

  it('teamLeadHasImportAndExport', async () => {
    mockFetch(routes(TEAM_LEAD));
    renderApp('/contacts');
    await rowWith('Asha Rao');
    expect(screen.getByRole('button', { name: 'Import' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export' })).toBeVisible();
  });

  it('agentSeesNoImportOrExport', async () => {
    mockFetch(routes(AGENT_IN_BRAND));
    renderApp('/contacts');
    await rowWith('Asha Rao');
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});
