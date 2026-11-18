import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkAddressesCard } from '@app/Customers/LinkAddressesCard';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { renderApp } from '../../test/renderApp';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { BRAND_B, PAGES_ADDRESSES, brandRow } from '../../test/pagesAddresses';

const LIST = 'GET /api/customers/c1/pages-addresses';
const PUT_B = 'PUT /api/customers/c1/workspaces/w2/pages-address';
const PUT_A = 'PUT /api/customers/c1/workspaces/w1/pages-address';
const CHECK_A = 'POST /api/customers/c1/workspaces/w1/pages-address/check';

const Host: React.FunctionComponent = () => {
  const { status } = useSession();
  return status === 'signedIn' ? <LinkAddressesCard customerId="c1" /> : null;
};

function show(routes: Parameters<typeof mockFetch>[0] = {}) {
  const fetch = mockFetch({ ...meAs(SUPER_ADMIN), [LIST]: { status: 200, body: PAGES_ADDRESSES }, ...routes });
  const user = userEvent.setup();
  render(
    <SessionProvider>
      <Host />
    </SessionProvider>,
  );
  return { fetch, user };
}

const row = async (brand: string) => within(await screen.findByRole('row', { name: new RegExp(`^${brand}\\b`) }));
const dialog = () => within(screen.getByRole('dialog'));

/** A reply held back until {@code release(body)}. */
function held() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    release(value: unknown) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(value)));
      controller.close();
    },
  };
}

describe('link addresses card', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows each brand with its address and status', async () => {
    show();
    const a = await row('Brand A');
    expect(a.getByText('https://links.branda.in')).toBeInTheDocument();
    expect(a.getByText('Working')).toBeInTheDocument();
    expect(a.getByRole('button', { name: 'Change…' })).toBeInTheDocument();
  });

  it('a brand without an address says it uses the platform address', async () => {
    show();
    const b = await row('Brand B');
    expect(b.getByText('Uses the platform address')).toBeInTheDocument();
    expect(b.getByRole('button', { name: 'Set…' })).toBeInTheDocument();
  });

  it('former hosts show with their end date', async () => {
    show();
    expect(
      await screen.findByText(
        /Earlier address old\.brandb\.in must keep working until .*2027, for links already sent\./,
      ),
    ).toBeInTheDocument();
  });

  it('a failing address shows why', async () => {
    show({
      [LIST]: {
        status: 200,
        body: {
          ...PAGES_ADDRESSES,
          brands: [
            brandRow({
              address: {
                baseUrl: 'https://links.branda.in',
                status: 'FAILING',
                checkedAt: '2026-11-18T04:15:00Z',
                lastError: 'The address did not answer',
                inUse: false,
              },
            }),
          ],
        },
      },
    });
    const a = await row('Brand A');
    expect(a.getByText('Failing')).toBeInTheDocument();
    expect(a.getByText(/The address did not answer/)).toBeInTheDocument();
  });

  it('Set saves and shows the checked status', async () => {
    const saved = {
      ...BRAND_B,
      address: { baseUrl: 'https://links.brandb.in', status: 'WORKING', checkedAt: null, lastError: null, inUse: true },
      version: 6,
    };
    const { fetch, user } = show({ [PUT_B]: { status: 200, body: saved } });
    await user.click((await row('Brand B')).getByRole('button', { name: 'Set…' }));
    expect(dialog().getByRole('heading', { name: 'Link address of Brand B' })).toBeInTheDocument();
    const field = dialog().getByLabelText('Address');
    expect(field).toHaveFocus();
    await user.type(field, 'https://links.brandb.in');
    await user.click(dialog().getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(fetch, PUT_B)?.body).toEqual({ baseUrl: 'https://links.brandb.in', version: 5 });
    const b = await row('Brand B');
    expect(b.getByText('https://links.brandb.in')).toBeInTheDocument();
    expect(b.getByText('Working')).toBeInTheDocument();
  });

  it("the dialog words the customer's step as the address is typed", async () => {
    const { user } = show();
    await user.click((await row('Brand B')).getByRole('button', { name: 'Set…' }));
    expect(dialog().queryByText(/CNAME/)).toBeNull();
    await user.type(dialog().getByLabelText('Address'), 'https://user-task.bimalinstitute.com');
    expect(
      dialog().getByText('Add a CNAME record for user-task.bimalinstitute.com pointing to go.example.in.'),
    ).toBeInTheDocument();
    expect(
      dialog().getByText(
        'A new subdomain can need a minute for its certificate. If the first check fails, check again.',
      ),
    ).toBeInTheDocument();
  });

  it('changing an address says the old one must keep working', async () => {
    const { user } = show();
    await user.click((await row('Brand A')).getByRole('button', { name: 'Change…' }));
    expect(dialog().getByLabelText('Address')).toHaveValue('https://links.branda.in');
    expect(
      dialog().getByText('links.branda.in must keep working for 90 days after the change, for links already sent.'),
    ).toBeInTheDocument();
  });

  it("a refused address stays in the dialog with the server's message", async () => {
    const { user } = show({
      [PUT_B]: { status: 400, body: { code: 'VALIDATION', fields: { baseUrl: 'Use https://' } } },
    });
    await user.click((await row('Brand B')).getByRole('button', { name: 'Set…' }));
    await user.type(dialog().getByLabelText('Address'), 'http://links.brandb.in');
    await user.click(dialog().getByRole('button', { name: 'Save' }));
    expect(await dialog().findByText('Use https://')).toBeInTheDocument();
    expect(dialog().getByLabelText('Address')).toHaveValue('http://links.brandb.in');
  });

  it('a taken domain says so', async () => {
    const { user } = show({
      [PUT_B]: {
        status: 409,
        body: { code: 'PAGES_HOST_TAKEN', field: 'baseUrl', message: 'Another customer uses this domain' },
      },
    });
    await user.click((await row('Brand B')).getByRole('button', { name: 'Set…' }));
    await user.type(dialog().getByLabelText('Address'), 'https://links.shared.in');
    await user.click(dialog().getByRole('button', { name: 'Save' }));
    expect(await dialog().findByText('Another customer uses this domain.')).toBeInTheDocument();
    expect(dialog().getByLabelText('Address')).toHaveValue('https://links.shared.in');
  });

  it('a stale version says so', async () => {
    const { user } = show({ [PUT_B]: { status: 409, body: { code: 'CONFLICT', message: 'changed meanwhile' } } });
    await user.click((await row('Brand B')).getByRole('button', { name: 'Set…' }));
    await user.type(dialog().getByLabelText('Address'), 'https://links.brandb.in');
    await user.click(dialog().getByRole('button', { name: 'Save' }));
    expect(
      await dialog().findByText('Someone else changed this address. Close and open it again.'),
    ).toBeInTheDocument();
  });

  it('after a stale version, closing and opening again saves with the fresh version', async () => {
    let lists = 0;
    const { fetch, user } = show({
      [LIST]: () => {
        lists++;
        return {
          status: 200,
          body: lists === 1 ? PAGES_ADDRESSES : { ...PAGES_ADDRESSES, brands: [brandRow({ version: 7 }), BRAND_B] },
        };
      },
      [PUT_A]: (req) =>
        (req.body as { version: number }).version === 7
          ? { status: 200, body: brandRow({ version: 8 }) }
          : { status: 409, body: { code: 'CONFLICT', message: 'changed meanwhile' } },
    });
    await user.click((await row('Brand A')).getByRole('button', { name: 'Change…' }));
    await user.click(dialog().getByRole('button', { name: 'Save' }));
    expect(
      await dialog().findByText('Someone else changed this address. Close and open it again.'),
    ).toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(lists).toBe(2));
    await user.click((await row('Brand A')).getByRole('button', { name: 'Change…' }));
    await user.click(dialog().getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(callsTo(fetch, PUT_A)).toBe(2);
  });

  it('an empty address is not sent and asks for one', async () => {
    const { fetch, user } = show();
    await user.click((await row('Brand A')).getByRole('button', { name: 'Change…' }));
    await user.clear(dialog().getByLabelText('Address'));
    await user.click(dialog().getByRole('button', { name: 'Save' }));
    expect(await dialog().findByText('Enter an address')).toBeInTheDocument();
    expect(callsTo(fetch, PUT_A)).toBe(0);
  });

  it('Check disables the row while it runs and shows the result', async () => {
    const reply = held();
    const { fetch, user } = show({ [CHECK_A]: reply.response });
    const a = await row('Brand A');
    await user.click(a.getByRole('button', { name: 'Check' }));
    expect(await a.findByText('Checking…')).toBeInTheDocument();
    expect(a.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(a.getByRole('button', { name: 'Change…' })).toBeDisabled();
    await user.click(a.getByRole('button', { name: 'Check' }));
    expect(callsTo(fetch, CHECK_A)).toBe(1);
    reply.release(
      brandRow({
        address: {
          baseUrl: 'https://links.branda.in',
          status: 'FAILING',
          checkedAt: '2026-11-18T06:00:00Z',
          lastError: 'The certificate is not valid',
          inUse: false,
        },
      }),
    );
    expect(await a.findByText('Failing')).toBeInTheDocument();
    expect(a.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('Remove asks first and sends baseUrl null', async () => {
    const { fetch, user } = show({
      [PUT_A]: {
        status: 200,
        body: brandRow({
          address: null,
          formerHosts: [{ host: 'links.branda.in', until: '2027-02-16T00:00:00Z' }],
          version: 4,
        }),
      },
    });
    await user.click((await row('Brand A')).getByRole('button', { name: 'Remove' }));
    expect(
      dialog().getByText(
        'Remove the link address of Brand A? Its links will use the platform address. links.branda.in must keep working for 90 days, for links already sent.',
      ),
    ).toBeInTheDocument();
    expect(callsTo(fetch, PUT_A)).toBe(0);
    await user.click(dialog().getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(callsTo(fetch, PUT_A)).toBe(1));
    expect(requestTo(fetch, PUT_A)?.body).toEqual({ baseUrl: null, version: 3 });
    expect((await row('Brand A')).getByText('Uses the platform address')).toBeInTheDocument();
  });

  it('an account manager sees no card and nothing is asked for', async () => {
    const detail = {
      customer: {
        id: 'c1',
        name: 'Acme',
        active: true,
        disabled: null,
        creationTime: '2026-10-20T10:00:00Z',
        planName: null,
        subscriptionState: 'NONE',
      },
      workspaces: [{ id: 'w1', name: 'Brand A', disabled: null }],
      admins: [],
    };
    const fetch = mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/customers/c1': { status: 200, body: detail } });
    renderApp('/customers/c1');
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(screen.queryByText('Link addresses')).toBeNull();
    expect(callsTo(fetch, LIST)).toBe(0);
  });
});
