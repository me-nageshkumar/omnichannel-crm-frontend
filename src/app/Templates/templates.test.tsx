import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import {
  AGENT_IN_BRAND,
  BRAND_A,
  BRAND_B,
  CUSTOMER_ADMIN,
  WORKSPACE_MANAGER,
  meAs,
  storeSession,
} from '../../test/session';
import { fill, rowAction, rowWith, urlsOf } from '../../test/admin';
import { placeholderView, template } from '../../test/templates';

const B = '/api/workspaces/w1';
const WELCOME = template({
  id: 't1',
  name: 'Welcome',
  category: 'Promo',
  placeholders: [placeholderView({ name: 'contact.name' }), placeholderView({ name: 'order_id' })],
});
const MENU = template({ id: 't2', name: 'Menu', type: 'IMAGE', category: null });

const Where: React.FunctionComponent = () => {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
};

function routes(extra = {}, user = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [`GET ${B}/templates`]: { status: 200, body: [WELCOME, MENU] },
    [`GET ${B}/templates/categories`]: { status: 200, body: ['Promo', 'Support'] },
    ...extra,
  };
}

const lastList = (fetch: ReturnType<typeof mockFetch>) => urlsOf(fetch, `GET ${B}/templates`).slice(-1)[0];

const dialog = () => screen.findByRole('dialog');

describe('templates list', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsTemplates', async () => {
    mockFetch(routes());
    renderApp('/templates');
    const row = await rowWith('Welcome');
    expect(within(row).getByRole('link', { name: 'Welcome' })).toHaveAttribute('href', '/templates/t1');
    expect(within(row).getByText('Text')).toBeVisible();
    expect(within(row).getByText('Promo')).toBeVisible();
    expect(within(row).getByText('2')).toBeVisible();
    expect(within(row).getByText(/^Meera Manager · /)).toBeVisible();
    const menu = await rowWith('Menu');
    expect(within(menu).getByText('Image')).toBeVisible();
  });

  it('showsEmptyState', async () => {
    mockFetch(routes({ [`GET ${B}/templates`]: { status: 200, body: [] } }));
    renderApp('/templates');
    expect(await screen.findByText('No templates match.')).toBeVisible();
  });

  it('filtersSendQuery', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/templates');
    await rowWith('Welcome');
    expect(urlsOf(fetch, `GET ${B}/templates`)[0]).toBe(`${B}/templates?status=ACTIVE`);

    await user.type(screen.getByRole('textbox', { name: 'Search templates' }), 'wel');
    await vi.waitFor(() => expect(lastList(fetch)).toContain('q=wel'));

    await user.click(screen.getByRole('button', { name: /^Type/ }));
    await user.click(await screen.findByRole('option', { name: 'Image' }));
    await vi.waitFor(() => expect(lastList(fetch)).toContain('type=IMAGE'));

    await user.click(screen.getByRole('button', { name: /^Category/ }));
    await user.click(await screen.findByRole('option', { name: 'Support' }));
    await vi.waitFor(() => expect(lastList(fetch)).toContain('category=Support'));
    const last = new URL(lastList(fetch) as string, 'http://x').searchParams;
    expect(Object.fromEntries(last)).toEqual({ q: 'wel', type: 'IMAGE', category: 'Support', status: 'ACTIVE' });
  });

  it('archivedToggle', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/templates');
    await rowWith('Welcome');
    await user.click(screen.getByRole('button', { name: 'Archived' }));
    await vi.waitFor(() => expect(lastList(fetch)).toContain('status=ARCHIVED'));
    await user.click(screen.getByRole('button', { name: 'Active' }));
    await vi.waitFor(() => expect(lastList(fetch)).toContain('status=ACTIVE'));
  });

  it('warningIconShown', async () => {
    const text = 'Attribute "city" was deleted — fallback will be used';
    mockFetch(routes({ [`GET ${B}/templates`]: { status: 200, body: [{ ...WELCOME, warnings: [text] }, MENU] } }));
    const { user } = renderApp('/templates');
    const row = await rowWith('Welcome');
    const icon = within(row).getByLabelText('Has warnings');
    expect(within(await rowWith('Menu')).queryByLabelText('Has warnings')).toBeNull();
    await user.hover(icon);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('createMenuNavigatesWithType', async () => {
    mockFetch(routes());
    const { user } = renderApp('/templates', <Where />);
    await user.click(await screen.findByRole('button', { name: 'Create template' }));
    const labels = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(labels).toEqual(['Text', 'Image', 'Video', 'Document', 'Audio', 'Location', 'Contact card', 'Poll']);
    await user.click(screen.getByRole('menuitem', { name: 'Poll' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/templates/new?type=POLL');
  });

  it('duplicateToSisterBrand', async () => {
    const fetch = mockFetch(
      routes(
        { [`POST ${B}/templates/t1/duplicate`]: { status: 201, body: template({ id: 't9', workspaceId: 'w2' }) } },
        CUSTOMER_ADMIN,
      ),
    );
    const { user } = renderApp('/templates', <Where />);
    await rowAction(user, 'Welcome', 'Duplicate');
    const d = await dialog();
    expect(within(d).getByLabelText(/^Name/)).toHaveValue('Welcome (copy)');
    await user.selectOptions(within(d).getByLabelText(/^Brand/), 'Brand B');
    await user.click(within(d).getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByText('Copied to Brand B')).toBeVisible();
    expect(requestTo(fetch, `POST ${B}/templates/t1/duplicate`)?.body).toEqual({
      targetWorkspaceId: 'w2',
      name: 'Welcome (copy)',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/templates$/);
  });

  it('duplicateInSameBrandOpensTheCopy', async () => {
    mockFetch(routes({ [`POST ${B}/templates/t1/duplicate`]: { status: 201, body: template({ id: 't9' }) } }));
    const { user } = renderApp('/templates', <Where />);
    await rowAction(user, 'Welcome', 'Duplicate');
    const d = await dialog();
    await fill(user, 'Name', 'Welcome 2');
    await user.click(within(d).getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/templates/t9');
  });

  it('duplicateListsOnlyBrandsWithManage', async () => {
    const readOnlyB = { ...BRAND_B, authorities: ['template:view'] };
    mockFetch(routes({}, { ...CUSTOMER_ADMIN, workspaces: [BRAND_A, readOnlyB] }));
    const { user } = renderApp('/templates');
    await rowAction(user, 'Welcome', 'Duplicate');
    const select = within(await dialog()).getByLabelText(/^Brand/);
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Brand A']);
  });

  it('duplicateNameTakenShowsFieldError', async () => {
    mockFetch(
      routes({ [`POST ${B}/templates/t1/duplicate`]: { status: 409, body: { code: 'DUPLICATE', field: 'name' } } }),
    );
    const { user } = renderApp('/templates');
    await rowAction(user, 'Welcome', 'Duplicate');
    await user.click(within(await dialog()).getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByText('Name is already in use.')).toBeVisible();
  });

  it('deleteConfirmAndInUseMessage', async () => {
    let n = 0;
    const inUse = 'This template has been used; archive it instead';
    const fetch = mockFetch(
      routes({
        [`DELETE ${B}/templates/t1`]: () =>
          n++ === 0 ? { status: 409, body: { code: 'TEMPLATE_IN_USE', message: inUse } } : { status: 204 },
      }),
    );
    const { user } = renderApp('/templates');
    await rowAction(user, 'Welcome', 'Delete');
    const d = await dialog();
    expect(within(d).getByText('Delete "Welcome"? This cannot be undone.')).toBeVisible();
    await user.click(within(d).getByRole('button', { name: 'Delete' }));
    expect(await within(d).findByText(inUse)).toBeVisible();
    await user.click(within(d).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(screen.queryByText('Welcome')).toBeNull());
    expect(callsTo(fetch, `DELETE ${B}/templates/t1`)).toBe(2);
  });

  it('archiveUnarchive', async () => {
    const archived = { ...WELCOME, status: 'ARCHIVED' as const };
    let n = 0;
    const fetch = mockFetch(
      routes({
        [`GET ${B}/templates`]: () => ({ status: 200, body: n++ === 0 ? [WELCOME, MENU] : [archived] }),
        [`POST ${B}/templates/t1/archive`]: { status: 200, body: archived },
        [`POST ${B}/templates/t1/unarchive`]: { status: 200, body: WELCOME },
      }),
    );
    const { user } = renderApp('/templates');
    await rowAction(user, 'Welcome', 'Archive');
    await vi.waitFor(() => expect(screen.queryByText('Welcome')).toBeNull());
    expect(callsTo(fetch, `POST ${B}/templates/t1/archive`)).toBe(1);
    expect(await screen.findByText('Menu')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Archived' }));
    await rowAction(user, 'Welcome', 'Unarchive');
    await vi.waitFor(() => expect(screen.queryByText('Welcome')).toBeNull());
    expect(callsTo(fetch, `POST ${B}/templates/t1/unarchive`)).toBe(1);
  });

  it('editActionOpensTheEditor', async () => {
    mockFetch(routes());
    const { user } = renderApp('/templates', <Where />);
    await rowAction(user, 'Welcome', 'Edit');
    expect(await screen.findByTestId('where')).toHaveTextContent('/templates/t1');
  });

  it('agentSeesReadOnly', async () => {
    mockFetch(routes({}, AGENT_IN_BRAND));
    renderApp('/templates');
    const row = await rowWith('Welcome');
    expect(within(row).getByRole('link', { name: 'Welcome' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create template' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });

  it('hiddenWithoutTemplateView', async () => {
    const noTemplates = {
      ...WORKSPACE_MANAGER,
      workspaces: [{ ...BRAND_A, authorities: BRAND_A.authorities.filter((a) => !a.startsWith('template:')) }],
    };
    mockFetch(meAs(noTemplates));
    renderApp('/templates');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Templates', hidden: true })).toBeNull();
  });
});
