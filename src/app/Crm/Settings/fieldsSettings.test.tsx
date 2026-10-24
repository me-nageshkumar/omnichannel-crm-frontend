import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, crmStatus, sampleField } from '../../../test/crm';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import type { FieldDefinition } from '@app/api/crm';

const BASE = '/api/workspaces/w1/crm';
const NICK = sampleField();
const SIZE = sampleField({ id: 'f2', key: 'shoeSize', label: 'Shoe size', type: 'NUMBER', position: 2 });
const TIER = sampleField({ id: 'f3', entityType: 'DEAL', key: 'tier', label: 'Tier', type: 'SELECT', position: 1 });

function routes(fields: FieldDefinition[] = [NICK, SIZE, TIER], limit: number | null = 20, extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}/status`]: {
      status: 200,
      body: crmStatus({
        authorities: ['crm:view', 'crm:settings'],
        limits: { maxPipelines: 3, maxCustomFields: limit },
      }),
    },
    [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
    [`GET ${BASE}/pipelines`]: { status: 200, body: [] },
    [`GET ${BASE}/fields`]: { status: 200, body: fields },
    ...extra,
  };
}

async function openFields(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('tab', { name: 'Fields' }));
  await screen.findByRole('button', { name: 'Add field' });
}

describe('CRM fields settings', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    // jsdom has no layout; give each field row a box so keyboard sorting can tell above from below.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const i = Number((this as HTMLElement).dataset?.fieldIndex ?? NaN);
      const top = Number.isNaN(i) ? 0 : i * 100;
      const height = Number.isNaN(i) ? 0 : 100;
      return { top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('createsSelectFieldWithOptions', async () => {
    const f = mockFetch(
      routes(undefined, undefined, {
        [`POST ${BASE}/fields`]: ({ body }: { body: object }) => ({
          status: 201,
          body: sampleField({ ...body, id: 'f9' } as Partial<FieldDefinition>),
        }),
      }),
    );
    const { user } = renderApp('/crm/settings');
    await openFields(user);
    await user.click(screen.getByRole('tab', { name: 'Deal' }));
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    const dialog = await screen.findByRole('dialog', { name: 'New field' });
    await user.type(within(dialog).getByLabelText(/^Label/), 'Budget tier');
    expect(within(dialog).getByLabelText(/^Key/)).toHaveValue('budgetTier');
    await user.selectOptions(within(dialog).getByLabelText(/^Type/), 'SELECT');
    await user.click(within(dialog).getByRole('button', { name: 'Add option' }));
    await user.type(within(dialog).getAllByLabelText('Option label')[0], 'Gold');
    await user.click(within(dialog).getByRole('button', { name: 'Add option' }));
    await user.type(within(dialog).getAllByLabelText('Option label')[1], 'Silver plus');
    await user.click(within(dialog).getByLabelText('Show in lists'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/fields`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/fields`)?.body).toMatchObject({
      entityType: 'DEAL',
      key: 'budgetTier',
      label: 'Budget tier',
      type: 'SELECT',
      showInList: true,
      options: [
        { key: 'gold', label: 'Gold', active: true },
        { key: 'silver_plus', label: 'Silver plus', active: true },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New field' })).toBeNull());
  });

  it('keyReadOnlyOnEdit', async () => {
    const f = mockFetch(
      routes(undefined, undefined, {
        [`PUT ${BASE}/fields/f1`]: ({ body }: { body: object }) => ({ status: 200, body: { ...NICK, ...body } }),
      }),
    );
    const { user } = renderApp('/crm/settings');
    await openFields(user);
    await user.click(screen.getByRole('button', { name: 'Edit Nickname' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit field' });
    expect(within(dialog).getByLabelText(/^Key/)).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText(/^Type/)).toBeDisabled();
    const label = within(dialog).getByLabelText(/^Label/);
    await user.clear(label);
    await user.type(label, 'Known as');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/fields/f1`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/fields/f1`)?.body).toMatchObject({
      key: 'nickname',
      type: 'TEXT',
      label: 'Known as',
      version: 0,
    });
  });

  it('addDisabledAtLimit', async () => {
    mockFetch(routes(undefined, 2));
    const { user } = renderApp('/crm/settings');
    await openFields(user);
    const add = screen.getByRole('button', { name: 'Add field' });
    await waitFor(() => expect(add).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await user.hover(add);
    expect(await screen.findByText('Your plan allows 2 fields per record type')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Deal' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add field' })).not.toHaveAttribute('aria-disabled', 'true'),
    );
  });

  it('reorderSendsIds', async () => {
    const f = mockFetch(routes(undefined, undefined, { [`PUT ${BASE}/fields/reorder`]: { status: 204 } }));
    const { user } = renderApp('/crm/settings');
    await openFields(user);
    const handle = screen.getByRole('button', { name: 'Reorder Nickname' });
    handle.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/fields/reorder`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/fields/reorder`)?.body).toEqual({ entityType: 'CONTACT', ids: ['f2', 'f1'] });
  });

  it('deactivateSendsDelete', async () => {
    const f = mockFetch(routes(undefined, undefined, { [`DELETE ${BASE}/fields/f2`]: { status: 204 } }));
    const { user } = renderApp('/crm/settings');
    await openFields(user);
    await user.click(screen.getByRole('switch', { name: 'Shoe size active' }));
    await waitFor(() => expect(requestTo(f, `DELETE ${BASE}/fields/f2`)).toBeDefined());
  });
});
