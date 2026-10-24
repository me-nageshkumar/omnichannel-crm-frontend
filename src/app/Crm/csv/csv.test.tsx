import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleCrmContact, samplePipeline } from '../../../test/crm';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { storeSession } from '../../../test/session';

const SEARCH = `POST ${BASE}/contacts/search`;
const EXPORT = `POST ${BASE}/contacts/export`;
const IMPORT = `POST ${BASE}/contacts/import`;
const PHONES = [
  { phoneNumberId: 'n1', number: '919928088743', label: 'Sales', canChat: true },
  { phoneNumberId: 'n2', number: '919928088744', label: 'Support', canChat: false },
];

const routes = (extra = {}, authorities = ['crm:view', 'crm:edit', 'crm:export']) =>
  boardRoutes(
    {
      [SEARCH]: { status: 200, body: { items: [sampleCrmContact()], total: 1, page: 0 } },
      [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
      [`GET ${BASE}/pipelines`]: { status: 200, body: [samplePipeline()] },
      ...extra,
    },
    { authorities, phones: PHONES },
  );

const csv = (text: string) => new File([text], 'contacts.csv', { type: 'text/csv' });

describe('CRM CSV', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exportSendsCurrentFiltersAndSaves', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    let saved = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved = this.download;
    });
    const f = mockFetch(
      routes({
        [EXPORT]: {
          status: 200,
          text: '﻿First name\r\nPriya\r\n',
          headers: {
            'Content-Type': 'text/csv;charset=UTF-8',
            'Content-Disposition': 'attachment; filename="crm-contacts-20261024-1015.csv"',
          },
        },
      }),
    );
    const { user } = renderApp('/crm/contacts?lifecycle=lead');
    await screen.findByRole('grid', { name: 'CRM contacts' });
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(requestTo(f, EXPORT)).toBeDefined());
    expect(requestTo(f, EXPORT)?.body).toMatchObject({ lifecycleStatus: 'lead' });
    expect(requestTo(f, EXPORT)?.body.page).toBeUndefined();
    await waitFor(() => expect(saved).toBe('crm-contacts-20261024-1015.csv'));
  });

  it('exportHiddenWithoutAuthority', async () => {
    mockFetch(routes({}, ['crm:view', 'crm:edit']));
    renderApp('/crm/contacts');
    await screen.findByRole('grid', { name: 'CRM contacts' });
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeInTheDocument();
  });

  it('contactImportNeedsPipelineAndNumber', async () => {
    const f = mockFetch(
      routes({ [IMPORT]: { status: 200, body: { total: 2, created: 2, updated: 0, skipped: 0, errors: [] } } }),
    );
    const { user } = renderApp('/crm/contacts');
    await user.click(await screen.findByRole('button', { name: 'Import CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    const go = within(dialog).getByRole('button', { name: 'Import' });
    expect(go).toBeDisabled();
    await user.upload(
      within(dialog).getByLabelText('CSV file'),
      csv('WhatsApp number,First name\r\n919900000001,Asha\r\n919900000002,Ravi\r\n'),
    );
    expect(await within(dialog).findByRole('cell', { name: 'Asha' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('WhatsApp number')).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: /Support/ })).toBeNull();
    await user.selectOptions(within(dialog).getByLabelText('WhatsApp number'), 'n1');
    expect(go).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Pipeline'), 'p1');
    expect(go).toBeEnabled();
    await user.click(go);
    await waitFor(() => expect(callsTo(f, IMPORT)).toBe(1));
    const url = new URL(String(f.mock.calls.find(([u]) => String(u).includes('/contacts/import'))?.[0]), 'http://x');
    expect(url.searchParams.get('pipelineId')).toBe('p1');
    expect(url.searchParams.get('phoneNumberId')).toBe('n1');
    expect(await within(dialog).findByText('2 created')).toBeInTheDocument();
  });

  it('missingHeaderMessage', async () => {
    mockFetch(
      routes({
        [IMPORT]: { status: 400, body: { code: 'IMPORT_BAD_HEADER', message: 'x', missing: 'WhatsApp number' } },
      }),
    );
    const { user } = renderApp('/crm/contacts');
    await user.click(await screen.findByRole('button', { name: 'Import CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    await user.upload(within(dialog).getByLabelText('CSV file'), csv('Phone,First name\n919900000001,Asha\n'));
    expect(await within(dialog).findByText('The file needs a "WhatsApp number" column.')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('WhatsApp number'), 'n1');
    await user.selectOptions(within(dialog).getByLabelText('Pipeline'), 'p1');
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByText('The file needs these columns: WhatsApp number')).toBeInTheDocument();
  });

  it('resultTableShowsRowErrors', async () => {
    mockFetch(
      routes({
        [`POST ${BASE}/companies/import`]: {
          status: 200,
          body: { total: 3, created: 1, updated: 1, skipped: 0, errors: [{ row: 3, message: 'Name is required' }] },
        },
        [`POST ${BASE}/companies/search`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      }),
    );
    const { user } = renderApp('/crm/companies');
    await user.click(await screen.findByRole('button', { name: 'Import CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import companies' });
    await user.upload(within(dialog).getByLabelText('CSV file'), csv('Name,Domain\nAcme,acme.com\nBeta,\n,x.com\n'));
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    const errors = await within(dialog).findByRole('grid', { name: 'Rows not imported' });
    expect(within(errors).getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(within(errors).getByRole('cell', { name: 'Name is required' })).toBeInTheDocument();
    expect(within(dialog).getByText('1 created')).toBeInTheDocument();
    expect(within(dialog).getByText('1 updated')).toBeInTheDocument();
  });
});
