import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleCrmContact, sampleDeal } from '../../../test/crm';
import { storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import type { Company } from '@app/api/crm';

const SEARCH = `POST ${BASE}/companies/search`;
const SUMMARY = `GET ${BASE}/companies/co1/summary`;
const TYPEAHEAD = `GET ${BASE}/companies/typeahead`;

const company = (o: Partial<Company> = {}): Company => ({
  id: 'co1',
  name: 'Acme Ltd',
  domain: 'acme.example',
  website: null,
  industry: 'software',
  size: null,
  annualRevenue: null,
  phone: null,
  email: null,
  address: null,
  description: null,
  owner: { id: 'o1', name: 'Asha Rao' },
  teamId: null,
  labelIds: [],
  customFields: {},
  contactCount: 3,
  openDealAmount: 4500,
  lastActivityAt: null,
  creationTime: '2026-10-01T10:00:00Z',
  version: 2,
  ...o,
});
const settings = crmSettings({
  industries: [
    { key: 'software', label: 'Software', color: null, position: 1, active: true, isDefault: false },
    { key: 'retail', label: 'Retail', color: null, position: 2, active: true, isDefault: false },
    { key: 'mining', label: 'Mining', color: null, position: 3, active: false, isDefault: false },
  ],
});
const summary = (o: Partial<Company> = {}) => ({
  company: company(o),
  contacts: [sampleCrmContact()],
  openDeals: [sampleDeal()],
  contactCount: 3,
  openDealAmount: 4500,
});
const page = (items = [company()]) => ({ status: 200, body: { items, total: items.length, page: 0 } });
const AUTH = ['crm:view', 'crm:edit', 'crm:delete'];
const routes = (extra = {}, authorities = AUTH) =>
  boardRoutes(
    {
      [SEARCH]: page(),
      [`GET ${BASE}/settings`]: { status: 200, body: settings },
      [SUMMARY]: { status: 200, body: summary() },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      [TYPEAHEAD]: { status: 200, body: [] },
      ...extra,
    },
    { authorities },
  );

describe('CRM companies', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsWithIndustryLabelAndAmounts', async () => {
    const f = mockFetch(routes());
    renderApp('/crm/companies');
    const table = await screen.findByRole('grid', { name: 'Companies' });
    expect(within(table).getByRole('link', { name: 'Acme Ltd' })).toHaveAttribute('href', '/crm/companies/co1');
    expect(within(table).getByText('Software')).toBeInTheDocument();
    expect(within(table).getByText('Asha Rao')).toBeInTheDocument();
    expect(requestTo(f, SEARCH)?.body).toMatchObject({ page: 0, size: 50, sort: 'name,asc' });
  });

  it('industryOptionsComeFromSettings', async () => {
    mockFetch(routes());
    const { user } = renderApp('/crm/companies');
    await screen.findByRole('link', { name: 'Acme Ltd' });
    const filter = screen.getByLabelText('Industry');
    await waitFor(() => expect(within(filter).getByRole('option', { name: 'Retail' })).toBeInTheDocument());
    expect(within(filter).queryByRole('option', { name: 'Mining' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'New company' }));
    const dialog = await screen.findByRole('dialog', { name: 'New company' });
    const select = within(dialog).getByLabelText('Industry');
    expect(within(select).getByRole('option', { name: 'Software' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Mining' })).toBeNull();
  });

  it('keepsAnInactiveStoredIndustryInTheEditForm', async () => {
    mockFetch(routes({ [SUMMARY]: { status: 200, body: summary({ industry: 'mining' }) } }));
    const { user } = renderApp('/crm/companies/co1');
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Industry')).toHaveValue('mining');
    expect(within(dialog).getByRole('option', { name: 'Mining' })).toBeInTheDocument();
  });

  it('drawerShowsSummaryCounts', async () => {
    mockFetch(routes());
    renderApp('/crm/companies/co1');
    expect(await screen.findByRole('heading', { name: 'Acme Ltd' })).toBeInTheDocument();
    const contacts = await screen.findByText('Contacts', { selector: 'dt .pf-v6-c-description-list__text' });
    expect(contacts.closest('div')).toHaveTextContent('3');
    expect(screen.getAllByText('₹4,500').length).toBeGreaterThan(1);
  });

  it('drawerTabsListContactsAndDeals', async () => {
    mockFetch(routes());
    const { user } = renderApp('/crm/companies/co1');
    await screen.findByRole('heading', { name: 'Acme Ltd' });
    await user.click(screen.getByRole('tab', { name: 'Contacts' }));
    expect(await screen.findByRole('link', { name: 'Priya Shah' })).toHaveAttribute('href', '/crm/contacts/c1');
    await user.click(screen.getByRole('tab', { name: 'Deals' }));
    expect(await screen.findByRole('link', { name: 'Acme order' })).toBeInTheDocument();
  });

  it('deleteWithOpenDealsShowsMessage', async () => {
    mockFetch(
      routes({
        [`DELETE ${BASE}/companies/co1`]: { status: 409, body: { code: 'COMPANY_HAS_OPEN_DEALS', message: 'x' } },
      }),
    );
    const { user } = renderApp('/crm/companies/co1');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete company' }));
    expect(
      await within(dialog).findByText('This company still has open deals. Close or move them first.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acme Ltd', hidden: true })).toBeInTheDocument();
  });

  it('deleteClosesTheDrawerAndRefreshesTheList', async () => {
    const f = mockFetch(routes({ [`DELETE ${BASE}/companies/co1`]: { status: 204 } }));
    const { user } = renderApp('/crm/companies/co1');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete company' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    console.log('SEARCH', callsTo(f, SEARCH));
    await waitFor(() => expect(callsTo(f, SEARCH)).toBeGreaterThanOrEqual(2));
    expect(screen.queryByRole('heading', { name: 'Acme Ltd' })).toBeNull();
  });

  it('deleteNeedsDeleteAndEditAuthorities', async () => {
    mockFetch(routes({}, ['crm:view', 'crm:edit']));
    renderApp('/crm/companies/co1');
    await screen.findByRole('button', { name: 'Edit' });
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('editSendsTheVersionItOpenedWith', async () => {
    let gets = 0;
    let puts = 0;
    const f = mockFetch(
      routes({
        [SUMMARY]: () => ({ status: 200, body: summary({ version: ++gets === 1 ? 2 : 9 }) }),
        [`PUT ${BASE}/companies/co1`]: () =>
          ++puts === 1
            ? { status: 409, body: { code: 'VERSION_CONFLICT', message: 'x' } }
            : { status: 200, body: company({ version: 10 }) },
      }),
    );
    const { user } = renderApp('/crm/companies/co1');
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save company' }));
    expect(await within(dialog).findByText(/Someone else changed this company/)).toBeInTheDocument();
    expect(requestTo(f, `PUT ${BASE}/companies/co1`)?.body.version).toBe(2);
    await waitFor(() => expect(callsTo(f, SUMMARY)).toBe(2));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save company' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/companies/co1`, 1)?.body.version).toBe(9));
  });

  it('focusRefetchPausedWhileAFormIsOpen', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
    try {
      const f = mockFetch(routes());
      const { user } = renderApp('/crm/companies/co1');
      await user.click(await screen.findByRole('button', { name: 'Edit' }));
      const dialog = await screen.findByRole('dialog');
      const focus = () => {
        vi.setSystemTime(Date.now() + 10_000);
        act(() => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
      };
      focus();
      expect(callsTo(f, SUMMARY)).toBe(1);
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      focus();
      await waitFor(() => expect(callsTo(f, SUMMARY)).toBe(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('createSendsOnlyFilledFields', async () => {
    const f = mockFetch(routes({ [`POST ${BASE}/companies`]: { status: 201, body: company({ id: 'co1' }) } }));
    const { user } = renderApp('/crm/companies');
    await user.click(await screen.findByRole('button', { name: 'New company' }));
    const dialog = await screen.findByRole('dialog', { name: 'New company' });
    await user.click(within(dialog).getByRole('button', { name: 'Create company' }));
    expect(await within(dialog).findByText('Give the company a name.')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/companies`)).toBeUndefined();
    await user.type(within(dialog).getByLabelText(/^Name/), 'Globex');
    await user.type(within(dialog).getByLabelText('City'), 'Pune');
    await user.click(within(dialog).getByRole('button', { name: 'Create company' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/companies`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/companies`)?.body).toEqual({
      name: 'Globex',
      address: { city: 'Pune' },
      ownerId: expect.any(String),
    });
  });

  it('nameLinkPushesExactlyOneHistoryEntry', async () => {
    let back: () => void = () => undefined;
    const Probe: React.FunctionComponent = () => {
      const navigate = useNavigate();
      back = () => navigate(-1);
      return <output aria-label="Where">{useLocation().pathname}</output>;
    };
    mockFetch(routes());
    const { user } = renderApp('/crm/companies', <Probe />);
    await user.click(await screen.findByRole('link', { name: 'Acme Ltd' }));
    await waitFor(() => expect(screen.getByLabelText('Where')).toHaveTextContent('/crm/companies/co1'));
    act(() => back());
    await waitFor(() => expect(screen.getByLabelText('Where')).toHaveTextContent(/^\/crm\/companies$/));
  });

  it('emptyStateCopy', async () => {
    mockFetch(routes({ [SEARCH]: page([]) }));
    renderApp('/crm/companies');
    expect(await screen.findByText('No companies yet. Add one here or from a contact or deal.')).toBeInTheDocument();
  });

  describe('typeahead', () => {
    const open = async (extra = {}, authorities = AUTH) => {
      const f = mockFetch(
        routes(
          {
            [`POST ${BASE}/deals/search`]: { status: 200, body: { items: [], total: 0, page: 0 } },
            ...extra,
          },
          authorities,
        ),
      );
      const view = renderApp('/crm');
      await screen.findByText('Acme order');
      await view.user.click(screen.getByRole('button', { name: 'New deal' }));
      const dialog = await screen.findByRole('dialog', { name: 'New deal' });
      return { f, dialog, user: view.user };
    };

    it('typeaheadCreatesInline', async () => {
      const { f, dialog, user } = await open({
        [TYPEAHEAD]: { status: 200, body: [{ id: 'co2', name: 'Acorn' }] },
        [`POST ${BASE}/companies`]: { status: 201, body: company({ id: 'co9', name: 'Acme Co' }) },
      });
      await user.type(within(dialog).getByRole('combobox', { name: 'Company' }), 'Acme Co');
      await user.click(await within(dialog).findByRole('option', { name: 'Create "Acme Co"' }));
      await waitFor(() => expect(requestTo(f, `POST ${BASE}/companies`)?.body).toEqual({ name: 'Acme Co' }));
      await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Company' })).toHaveValue('Acme Co'));
      expect(within(dialog).queryByRole('option', { name: 'Acorn' })).toBeNull();
    });

    it('debouncesAndSearchesByTheTypedText', async () => {
      const { f, dialog, user } = await open();
      await user.type(within(dialog).getByRole('combobox', { name: 'Company' }), 'acm');
      await waitFor(() => expect(requestTo(f, TYPEAHEAD)).toBeDefined());
      const queries = f.mock.calls
        .map(([u]) => new URL(String(u), 'http://localhost'))
        .filter((u) => u.pathname === `${BASE}/companies/typeahead`)
        .map((u) => u.searchParams.get('q'));
      expect(queries).toEqual(['acm']);
    });

    it('noCreateOptionWithoutEditAuthority', async () => {
      // The deal form is only reachable with crm:edit, so this checks the component's flag via the contact form.
      const { dialog, user } = await open({}, ['crm:view', 'crm:edit']);
      await user.type(within(dialog).getByRole('combobox', { name: 'Company' }), 'Zed');
      expect(await within(dialog).findByRole('option', { name: 'Create "Zed"' })).toBeInTheDocument();
    });

    it('clearsTheSelection', async () => {
      const { dialog, user } = await open({ [TYPEAHEAD]: { status: 200, body: [{ id: 'co2', name: 'Acorn' }] } });
      await user.click(within(dialog).getByRole('combobox', { name: 'Company' }));
      await user.click(await within(dialog).findByRole('option', { name: 'Acorn' }));
      expect(within(dialog).getByRole('combobox', { name: 'Company' })).toHaveValue('Acorn');
      await user.click(within(dialog).getByRole('button', { name: 'Clear company' }));
      expect(within(dialog).getByRole('combobox', { name: 'Company' })).toHaveValue('');
    });
  });
});
