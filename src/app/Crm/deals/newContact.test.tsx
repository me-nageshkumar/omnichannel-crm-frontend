import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { sampleDeal } from '../../../test/crm';
import { storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';

const PHONES = [
  { phoneNumberId: 'pn1', number: '919800000001', label: 'Sales line', canChat: true },
  { phoneNumberId: 'pn2', number: '919800000002', label: null, canChat: false },
  { phoneNumberId: 'pn3', number: '919800000003', label: 'Support', canChat: true },
];

async function open(extra = {}) {
  const f = mockFetch(boardRoutes(extra, { phones: PHONES }));
  const r = renderApp('/crm');
  await screen.findByText('Acme order');
  await r.user.click(screen.getByRole('button', { name: 'New contact' }));
  const dialog = await screen.findByRole('dialog', { name: 'New contact' });
  return { f, user: r.user, dialog };
}

describe('New contact', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('onlyChattableNumbersOffered', async () => {
    const { dialog } = await open();
    const select = within(dialog).getByLabelText(/^Channel number/);
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Sales line (919800000001)', 'Support (919800000003)']);
    expect(select).toHaveValue('pn1');
  });

  it('createsAndReloadsBoard', async () => {
    const result = { contact: {}, deal: sampleDeal(), createdContact: true, createdDeal: true };
    const { f, user, dialog } = await open({ [`POST ${BASE}/contacts/create`]: { status: 200, body: result } });
    await user.type(within(dialog).getByLabelText(/WhatsApp number/), '+91 98123 45678');
    await user.type(within(dialog).getByLabelText('First name'), 'Priya');
    await user.selectOptions(within(dialog).getByLabelText(/^Channel number/), 'pn3');
    await user.type(within(dialog).getByLabelText('Deal title'), 'Trial');
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/contacts/create`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/contacts/create`)?.body).toEqual({
      phone: '919812345678',
      phoneNumberId: 'pn3',
      firstName: 'Priya',
      pipelineId: 'p1',
      dealTitle: 'Trial',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(2));
  });

  it('phoneErrorShownOnField', async () => {
    const { user, dialog } = await open({
      [`POST ${BASE}/contacts/create`]: {
        status: 400,
        body: { code: 'VALIDATION', fields: { phone: 'Enter a valid WhatsApp number with country code.' } },
      },
    });
    await user.type(within(dialog).getByLabelText(/WhatsApp number/), '919812345678');
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    expect(await within(dialog).findByText('Enter a valid WhatsApp number with country code.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New contact' })).toBeInTheDocument();
  });

  it('numberIsRequired', async () => {
    const { f, user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    expect(await within(dialog).findByText('Use 8 to 15 digits, country code first.')).toBeInTheDocument();
    expect(callsTo(f, `POST ${BASE}/contacts/create`)).toBe(0);
  });
});
