import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleCrmContact, sampleDeal, sampleField, samplePipeline } from '../../../test/crm';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import type { Deal, FieldDefinition } from '@app/api/crm';
import { DealFormModal } from '@app/Crm/deals/DealFormModal';
import { SessionProvider } from '@app/session/SessionContext';
import { resetFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';

const TIER = sampleField({
  id: 'f1',
  entityType: 'DEAL',
  key: 'tier',
  label: 'Tier',
  type: 'SELECT',
  position: 1,
  showInCard: true,
  options: [
    { key: 'gold', label: 'Gold', color: null, position: 1, active: true },
    { key: 'silver', label: 'Silver', color: null, position: 2, active: true },
  ],
});
const BUDGET = sampleField({
  id: 'f2',
  entityType: 'DEAL',
  key: 'budget',
  label: 'Budget',
  type: 'CURRENCY',
  position: 2,
  showInCard: true,
});
const PO = sampleField({
  id: 'f3',
  entityType: 'DEAL',
  key: 'po',
  label: 'PO number',
  type: 'TEXT',
  position: 3,
  required: true,
});
const LEGACY = sampleField({
  id: 'f4',
  entityType: 'DEAL',
  key: 'legacy',
  label: 'Legacy code',
  position: 4,
  active: false,
});

function renderForm(deal: Deal | undefined, fields: FieldDefinition[], extra = {}) {
  const f = mockFetch({
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}/fields`]: { status: 200, body: fields },
    [`POST ${BASE}/contacts/search`]: { status: 200, body: { items: [sampleCrmContact()], total: 1, page: 0 } },
    ...extra,
  });
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <SessionProvider>
        <DealFormModal
          deal={deal}
          pipeline={samplePipeline()}
          settings={crmSettings()}
          onSaved={onSaved}
          onClose={() => undefined}
        />
      </SessionProvider>
    </MemoryRouter>,
  );
  return { f, user, onSaved };
}

describe('CRM custom fields on records', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    resetFieldDefinitions();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('dealFormSendsOnlyChangedCustomFields', async () => {
    const deal = sampleDeal({ customFields: { tier: 'gold', budget: 100, po: 'PO-1' } });
    const { f, user } = renderForm(deal, [TIER, BUDGET, PO], {
      [`PUT ${BASE}/deals/d1`]: { status: 200, body: deal },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    await user.click(await within(dialog).findByRole('button', { name: 'More fields' }));
    const budget = within(dialog).getByLabelText('Budget');
    expect(budget).toHaveValue(100);
    await user.clear(budget);
    await user.type(budget, '250');
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/deals/d1`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/deals/d1`)?.body.customFields).toEqual({ budget: 250 });
  });

  it('requiredFieldBlocksSaveClientSide', async () => {
    const { f, user } = renderForm(undefined, [TIER, PO], {
      [`POST ${BASE}/deals`]: { status: 200, body: sampleDeal() },
    });
    const dialog = await screen.findByRole('dialog', { name: 'New deal' });
    // a required field opens the section by itself
    const po = await within(dialog).findByLabelText(/^PO number/);
    await user.type(within(dialog).getByLabelText(/^Title/), 'Big order');
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /Priya Shah/ })).toBeInTheDocument());
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c1');
    await user.click(within(dialog).getByRole('button', { name: 'Create deal' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/deals`)).toBeUndefined();
    await user.type(po, 'PO-9');
    await user.selectOptions(within(dialog).getByLabelText('Tier'), 'silver');
    await user.click(within(dialog).getByRole('button', { name: 'Create deal' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/deals`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/deals`)?.body.customFields).toEqual({ po: 'PO-9', tier: 'silver' });
  });

  it('serverFieldErrorShownOnInput', async () => {
    const deal = sampleDeal({ customFields: { tier: 'gold' } });
    const { user } = renderForm(deal, [TIER], {
      [`PUT ${BASE}/deals/d1`]: {
        status: 400,
        body: { code: 'VALIDATION', message: 'x', fields: { 'customFields.tier': 'is no longer an option' } },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    await user.click(await within(dialog).findByRole('button', { name: 'More fields' }));
    await user.selectOptions(within(dialog).getByLabelText('Tier'), 'silver');
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    expect(await within(dialog).findByText('is no longer an option')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Tier')).toHaveAttribute('aria-invalid', 'true');
  });

  it('inactiveFieldShownReadOnlyAndNotSent', async () => {
    const deal = sampleDeal({ customFields: { tier: 'gold', legacy: 'L-7' } });
    const { f, user } = renderForm(deal, [TIER, LEGACY], {
      [`PUT ${BASE}/deals/d1`]: { status: 200, body: deal },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    await user.click(await within(dialog).findByRole('button', { name: 'More fields' }));
    const legacy = within(dialog).getByLabelText(/^Legacy code/);
    expect(legacy).toHaveValue('L-7');
    expect(legacy).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Tier'), 'silver');
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/deals/d1`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/deals/d1`)?.body.customFields).toEqual({ tier: 'silver' });
  });

  it('userFieldOffersBrandUsers', async () => {
    const MANAGER = sampleField({
      id: 'f7',
      entityType: 'DEAL',
      key: 'accountManager',
      label: 'Account manager',
      type: 'USER',
    });
    const deal = sampleDeal({ customFields: {} });
    const { f, user } = renderForm(deal, [MANAGER], {
      [`GET /api/workspaces/w1/users`]: { status: 200, body: [{ id: 'u7', name: 'Ravi Kumar' }] },
      [`PUT ${BASE}/deals/d1`]: { status: 200, body: deal },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    await user.click(await within(dialog).findByRole('button', { name: 'More fields' }));
    const select = within(dialog).getByLabelText('Account manager');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Ravi Kumar' })).toBeInTheDocument());
    await user.selectOptions(select, 'u7');
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/deals/d1`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/deals/d1`)?.body.customFields).toEqual({ accountManager: 'u7' });
  });

  it('serverErrorOnUnknownFieldRefetchesDefinitions', async () => {
    const BUDGET_REQ = sampleField({
      id: 'f8',
      entityType: 'DEAL',
      key: 'budget',
      label: 'Budget',
      type: 'CURRENCY',
      required: true,
    });
    let gets = 0;
    const { f, user } = renderForm(undefined, [], {
      [`GET ${BASE}/fields`]: () => ({ status: 200, body: ++gets === 1 ? [] : [BUDGET_REQ] }),
      [`POST ${BASE}/deals`]: {
        status: 400,
        body: { code: 'VALIDATION', message: 'x', fields: { 'customFields.budget': 'is required' } },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'New deal' });
    await user.type(within(dialog).getByLabelText(/^Title/), 'Big order');
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /Priya Shah/ })).toBeInTheDocument());
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c1');
    await user.click(within(dialog).getByRole('button', { name: 'Create deal' }));
    // an admin added the field meanwhile: the form fetches the definitions again and shows it with the error
    expect(await within(dialog).findByLabelText(/^Budget/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^(is required|This field is required\.)$/)).toBeInTheDocument();
    expect(gets).toBe(2);
    expect(f).toBeDefined();
  });

  it('contactsTableShowsListColumns', async () => {
    const BIRTHDAY = sampleField({ key: 'birthday', label: 'Birthday', type: 'TEXT', showInList: true });
    const HIDDEN = sampleField({ id: 'f9', key: 'secret', label: 'Secret', showInList: false });
    mockFetch(
      boardRoutes({
        [`POST ${BASE}/contacts/search`]: {
          status: 200,
          body: { items: [sampleCrmContact({ customFields: { birthday: 'May 1' } })], total: 1, page: 0 },
        },
        [`GET ${BASE}/fields`]: { status: 200, body: [BIRTHDAY, HIDDEN] },
      }),
    );
    renderApp('/crm/contacts');
    const table = await screen.findByRole('grid', { name: 'CRM contacts' });
    expect(await within(table).findByRole('columnheader', { name: 'Birthday' })).toBeInTheDocument();
    expect(within(table).getByText('May 1')).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Secret' })).toBeNull();
  });

  it('dealCardShowsCardFields', async () => {
    const NOTE = sampleField({
      id: 'f5',
      entityType: 'DEAL',
      key: 'note',
      label: 'Note',
      position: 3,
      showInCard: true,
    });
    const EXTRA = sampleField({
      id: 'f6',
      entityType: 'DEAL',
      key: 'extra',
      label: 'Extra',
      position: 4,
      showInCard: true,
    });
    const board = {
      pipelineId: 'p1',
      lanes: samplePipeline().stages.map((stage, i) => ({
        stage,
        total: i === 0 ? 1 : 0,
        sumAmount: 0,
        deals:
          i === 0
            ? [sampleDeal({ customFields: { tier: 'gold', budget: 5000, note: 'Rush', extra: 'Hidden fourth' } })]
            : [],
      })),
    };
    mockFetch(
      boardRoutes({
        [`GET ${BASE}/deals/board`]: { status: 200, body: board },
        [`GET ${BASE}/fields`]: { status: 200, body: [TIER, BUDGET, NOTE, EXTRA] },
      }),
    );
    renderApp('/crm');
    const card = (await screen.findByText('Acme order')).closest('[data-deal-id]') as HTMLElement;
    expect(await within(card).findByText('Gold')).toBeInTheDocument();
    expect(within(card).getByText(/5,000/)).toBeInTheDocument();
    expect(within(card).getByText('Rush')).toBeInTheDocument();
    expect(within(card).queryByText('Hidden fourth')).toBeNull();
  });
});
