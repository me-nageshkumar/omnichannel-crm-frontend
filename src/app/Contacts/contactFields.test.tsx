import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, TEAM_LEAD, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith } from '../../test/admin';
import { attribute, label } from '../../test/contacts';

const B = '/api/workspaces/w1';
const VIP = label({ id: 'l1', name: 'VIP', color: 'purple', description: 'Big spenders', contactCount: 12 });
const CITY = attribute({ id: 'a1', name: 'City', contactCount: 3 });

function routes(extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${B}/contact-labels`]: { status: 200, body: [VIP] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [CITY] },
    ...extra,
  };
}

describe('contact fields page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsLabelsAndAttributes', async () => {
    mockFetch(routes());
    renderApp('/contact-fields');
    const row = await rowWith('VIP');
    expect(within(row).getByText('Big spenders')).toBeVisible();
    expect(within(row).getByText('12')).toBeVisible();
    expect(within(await rowWith('City')).getByText('3')).toBeVisible();
  });

  it('attributeKeyShown', async () => {
    mockFetch(
      routes({
        [`GET ${B}/contact-attributes`]: {
          status: 200,
          body: [attribute({ id: 'a1', key: 'home_city', name: 'Home city' })],
        },
      }),
    );
    renderApp('/contact-fields');
    const row = await rowWith('Home city');
    expect(within(row).getByText('{{contact.attributes.home_city}}')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Placeholder' })).toBeVisible();
  });

  it('createsLabelWithColour', async () => {
    const created = label({ id: 'l2', name: 'Lead', color: 'teal' });
    const fetch = mockFetch(routes({ [`POST ${B}/contact-labels`]: { status: 201, body: created } }));
    const { user } = renderApp('/contact-fields');
    await user.click(await screen.findByRole('button', { name: 'Add label' }));
    await fill(user, 'Name', 'Lead');
    await user.click(screen.getByRole('button', { name: /^Colour/ }));
    await user.click(await screen.findByRole('option', { name: 'Teal' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    expect(await rowWith('Lead')).toBeVisible();
    expect(requestTo(fetch, `POST ${B}/contact-labels`)?.body).toEqual({
      name: 'Lead',
      color: 'teal',
      description: null,
    });
  });

  it('duplicateNameShowsFieldError', async () => {
    mockFetch(routes({ [`POST ${B}/contact-labels`]: { status: 409, body: { code: 'DUPLICATE', field: 'name' } } }));
    const { user } = renderApp('/contact-fields');
    await user.click(await screen.findByRole('button', { name: 'Add label' }));
    await fill(user, 'Name', 'vip');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Name is already in use.')).toBeVisible();
  });

  it('createsAttribute', async () => {
    const fetch = mockFetch(
      routes({
        [`POST ${B}/contact-attributes`]: { status: 201, body: attribute({ id: 'a2', name: 'Email' }) },
      }),
    );
    const { user } = renderApp('/contact-fields');
    await user.click(await screen.findByRole('button', { name: 'Add attribute' }));
    await fill(user, 'Name', 'Email');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    expect(await rowWith('Email')).toBeVisible();
    expect(requestTo(fetch, `POST ${B}/contact-attributes`)?.body).toEqual({ name: 'Email', description: null });
  });

  it('deleteShowsCount', async () => {
    const fetch = mockFetch(routes({ [`DELETE ${B}/contact-labels/l1`]: { status: 204 } }));
    const { user } = renderApp('/contact-fields');
    await rowAction(user, 'VIP', 'Delete');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete VIP?')).toBeVisible();
    expect(within(dialog).getByText('It is removed from 12 contacts.')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(screen.queryByText('Big spenders')).toBeNull());
    expect(callsTo(fetch, `DELETE ${B}/contact-labels/l1`)).toBe(1);
  });

  it('editRenamesLabel', async () => {
    const fetch = mockFetch(
      routes({ [`PUT ${B}/contact-labels/l1`]: { status: 200, body: { ...VIP, name: 'Gold' } } }),
    );
    const { user } = renderApp('/contact-fields');
    await rowAction(user, 'VIP', 'Edit');
    await fill(user, 'Name', 'Gold');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(await rowWith('Gold')).toBeVisible();
    expect(requestTo(fetch, `PUT ${B}/contact-labels/l1`)?.body).toMatchObject({ name: 'Gold', color: 'purple' });
  });

  it.each([
    ['team lead', TEAM_LEAD],
    ['agent', AGENT_IN_BRAND],
  ])('hiddenWithoutManageAuthority (%s)', async (_n, user) => {
    mockFetch(meAs(user));
    renderApp('/contact-fields');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });
});
