import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleCrmContact, sampleDeal, samplePipeline } from '../../../test/crm';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { DealFormModal } from '@app/Crm/deals/DealFormModal';
import { SessionProvider } from '@app/session/SessionContext';

const SETTINGS = crmSettings({
  dealSources: [
    { key: 'web', label: 'Website', color: null, position: 1, active: true, isDefault: false },
    { key: 'old', label: 'Retired', color: null, position: 2, active: false, isDefault: false },
  ],
});
const COMPANY = {
  id: 'co1',
  name: 'Acme Ltd',
};

describe('Deal form', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('createSendsPrimaryContactAndPipeline', async () => {
    const f = mockFetch(
      boardRoutes({
        [`GET ${BASE}/settings`]: { status: 200, body: SETTINGS },
        [`POST ${BASE}/contacts/search`]: {
          status: 200,
          body: { items: [sampleCrmContact()], total: 1, page: 0 },
        },
        [`POST ${BASE}/companies/search`]: { status: 200, body: { items: [COMPANY], total: 1, page: 0 } },
        [`POST ${BASE}/deals`]: { status: 200, body: sampleDeal({ id: 'd9' }) },
      }),
    );
    const { user } = renderApp('/crm');
    await screen.findByText('Acme order');
    await user.click(screen.getByRole('button', { name: 'New deal' }));
    const dialog = await screen.findByRole('dialog', { name: 'New deal' });
    await user.type(within(dialog).getByLabelText(/^Title/), 'Big order');
    await waitFor(() => expect(within(dialog).getByRole('option', { name: 'Priya Shah (919812345678)' })).toBeInTheDocument());
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c1');
    await user.type(within(dialog).getByLabelText('Amount'), '2500');
    await user.selectOptions(within(dialog).getByLabelText('Company'), 'co1');
    await user.selectOptions(within(dialog).getByLabelText('Source'), 'web');
    expect(within(dialog).queryByRole('option', { name: 'Retired' })).toBeNull();
    expect(within(dialog).getByLabelText('Currency')).toHaveValue('INR');
    await user.click(within(dialog).getByRole('button', { name: 'Create deal' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/deals`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/deals`)?.body).toMatchObject({
      title: 'Big order',
      pipelineId: 'p1',
      stageId: 's1',
      primaryCrmContactId: 'c1',
      crmContactIds: ['c1'],
      amount: 2500,
      currency: 'INR',
      companyId: 'co1',
      source: 'web',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('createNeedsTitleAndContact', async () => {
    const f = mockFetch(
      boardRoutes({
        [`POST ${BASE}/contacts/search`]: { status: 200, body: { items: [], total: 0, page: 0 } },
        [`POST ${BASE}/companies/search`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      }),
    );
    const { user } = renderApp('/crm');
    await screen.findByText('Acme order');
    await user.click(screen.getByRole('button', { name: 'New deal' }));
    const dialog = await screen.findByRole('dialog', { name: 'New deal' });
    await user.click(within(dialog).getByRole('button', { name: 'Create deal' }));
    expect(await within(dialog).findByText('Give the deal a title.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the contact this deal is with.')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/deals`)).toBeUndefined();
  });

  it('editSendsVersion', async () => {
    const f = mockFetch({
      [`POST ${BASE}/companies/search`]: { status: 200, body: { items: [COMPANY], total: 1, page: 0 } },
      [`PUT ${BASE}/deals/d1`]: ({ body }: { body: object }) => ({ status: 200, body: { ...sampleDeal(), ...body } }),
      ...meAs(WORKSPACE_MANAGER),
    });
    const onSaved = vi.fn();
    const deal = sampleDeal({ version: 7 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SessionProvider>
          <DealFormModal
            deal={deal}
            pipeline={samplePipeline()}
            settings={SETTINGS}
            owners={[{ id: 'o1', name: 'Asha Rao' }]}
            onSaved={onSaved}
            onClose={() => undefined}
          />
        </SessionProvider>
      </MemoryRouter>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Acme order');
    expect(within(dialog).getByLabelText('Amount')).toHaveValue(1500);
    expect(within(dialog).getByLabelText(/^Primary contact/)).toBeDisabled();
    const title = within(dialog).getByLabelText(/^Title/);
    await user.clear(title);
    await user.type(title, 'Acme order v2');
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = requestTo(f, `PUT ${BASE}/deals/d1`)?.body;
    expect(body).toMatchObject({ title: 'Acme order v2', version: 7, amount: 1500, currency: 'INR' });
    expect(body).not.toHaveProperty('pipelineId');
    expect(body).not.toHaveProperty('stageId');
  });
});
