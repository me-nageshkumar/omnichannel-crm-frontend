import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith } from '../../test/admin';
import { AUTHORITY_LIST, PROBE, authority } from '../../test/authorities';
import type { NeedsCreating } from '@app/api/authorities';

const XY: NeedsCreating = { code: 'x:y', suggestedLevel: 'BRAND', suggestedGroup: 'x', checkedIn: ['XController.y'] };

function routes(extra = {}, needs: NeedsCreating[] = [PROBE, XY]) {
  return {
    ...meAs(SUPER_ADMIN),
    'GET /api/authorities': { status: 200, body: AUTHORITY_LIST },
    'GET /api/authorities/needs-creating': { status: 200, body: needs },
    ...extra,
  };
}

const codeBox = () => screen.getByRole('combobox', { name: /^Code/ });
const levelSelect = () => screen.getByRole('combobox', { name: /^Level/ });
const TYPED_WARNING = /No code checks .* yet\. It will have no effect until it does\./;
const WRONG_LEVEL = /Checked as a (brand|platform) authority in code but created as/;

async function openAdd(user: ReturnType<typeof renderApp>['user']) {
  await rowWith('customer:view');
  await user.click(screen.getByRole('button', { name: 'Add authority' }));
  await screen.findByRole('dialog');
}

describe('authority dialogs', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('createFromNeedsCreatingPrefills', async () => {
    mockFetch(routes());
    const { user } = renderApp('/authorities');
    const panel = await screen.findByRole('region', { name: /Checked in code, not created yet/ });
    const probeRow = within(panel).getByText('test:probe').closest('tr') as HTMLElement;
    await user.click(within(probeRow).getByRole('button', { name: 'Create' }));
    await screen.findByRole('dialog');
    expect(codeBox()).toHaveValue('test:probe');
    expect(screen.getByLabelText(/^Group/)).toHaveValue('test');
    expect(levelSelect()).toHaveValue('');
    expect(screen.queryByText(TYPED_WARNING)).toBeNull();
  });

  it('pickingBrandSuggestionSetsLevel', async () => {
    mockFetch(routes());
    const { user } = renderApp('/authorities');
    await openAdd(user);
    await user.type(codeBox(), 'x:');
    await user.click(await screen.findByRole('option', { name: /x:y/ }));
    expect(codeBox()).toHaveValue('x:y');
    expect(levelSelect()).toHaveValue('BRAND');
    expect(screen.getByLabelText(/^Group/)).toHaveValue('x');
  });

  it('typedUnknownCodeWarns', async () => {
    const fetch = mockFetch(
      routes({ 'POST /api/authorities': { status: 201, body: authority('order:refnd', { status: 'NOT_CHECKED' }) } }),
    );
    const { user } = renderApp('/authorities');
    await openAdd(user);
    await user.type(codeBox(), 'order:refnd');
    expect(screen.getByText(TYPED_WARNING)).toBeVisible();
    await user.selectOptions(levelSelect(), 'PLATFORM');
    await fill(user, 'Description', 'Refund');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await vi.waitFor(() => expect(callsTo(fetch, 'POST /api/authorities')).toBe(1));
    expect(requestTo(fetch, 'POST /api/authorities')?.body).toEqual({
      code: 'order:refnd',
      group: 'order',
      level: 'PLATFORM',
      description: 'Refund',
    });
  });

  it('wrongLevelWarningInline', async () => {
    mockFetch(routes());
    const { user } = renderApp('/authorities');
    await openAdd(user);
    await user.type(codeBox(), 'test:');
    await user.click(await screen.findByRole('option', { name: /test:probe/ }));
    expect(screen.queryByText(WRONG_LEVEL)).toBeNull();
    await user.selectOptions(levelSelect(), 'BRAND');
    expect(screen.getByText(WRONG_LEVEL)).toBeVisible();
  });

  it('retypedCodeDropsScanContext', async () => {
    mockFetch(routes());
    const { user } = renderApp('/authorities');
    await openAdd(user);
    await user.type(codeBox(), 'x:');
    await user.click(await screen.findByRole('option', { name: /x:y/ }));
    await user.selectOptions(levelSelect(), 'PLATFORM');
    expect(screen.getByText(WRONG_LEVEL)).toBeVisible();
    await user.clear(codeBox());
    await user.type(codeBox(), 'x:z');
    expect(levelSelect()).toHaveValue('PLATFORM');
    expect(screen.getByText(TYPED_WARNING)).toBeVisible();
    expect(screen.queryByText(WRONG_LEVEL)).toBeNull();
  });

  it('clientValidationBlocksSubmit', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/authorities');
    await openAdd(user);
    await user.type(codeBox(), 'Bad Code');
    await user.selectOptions(levelSelect(), 'PLATFORM');
    await fill(user, 'Description', 'Bad');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText(/Use thing:action/)).toBeVisible();
    expect(callsTo(fetch, 'POST /api/authorities')).toBe(0);
  });

  it('duplicateShowsOnCodeField', async () => {
    mockFetch(routes({ 'POST /api/authorities': { status: 409, body: { code: 'DUPLICATE', field: 'code' } } }));
    const { user } = renderApp('/authorities');
    await openAdd(user);
    await user.type(codeBox(), 'customer:view');
    await user.selectOptions(levelSelect(), 'PLATFORM');
    await fill(user, 'Description', 'Again');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Code is already in use.')).toBeVisible();
  });

  it('editBuiltInDisablesLevel', async () => {
    mockFetch(routes());
    const { user } = renderApp('/authorities');
    await rowAction(user, 'customer:view', 'Edit');
    await screen.findByRole('dialog');
    expect(screen.getByLabelText(/^Code/)).toHaveAttribute('readonly');
    expect(levelSelect()).toBeDisabled();
    expect(screen.getByText('Built-in authorities keep their level.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const row = await rowWith('customer:view');
    await user.click(within(row).getByRole('button', { name: 'Kebab toggle' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('editInUseDisablesLevel', async () => {
    mockFetch(
      routes({
        'GET /api/authorities': {
          status: 200,
          body: [...AUTHORITY_LIST, authority('order:refund', { level: 'BRAND', roles: ['AGENT'] })],
        },
      }),
    );
    const { user } = renderApp('/authorities');
    await rowAction(user, 'order:refund', 'Edit');
    await screen.findByRole('dialog');
    expect(levelSelect()).toBeDisabled();
    expect(screen.getByText('In a role (AGENT). Remove it from roles to change its level.')).toBeVisible();
  });

  it('editSendsEncodedCode', async () => {
    const fetch = mockFetch(
      routes({ 'PUT /api/authorities/customer%3Aview': { status: 200, body: AUTHORITY_LIST[1] } }),
    );
    const { user } = renderApp('/authorities');
    await rowAction(user, 'customer:view', 'Edit');
    await screen.findByRole('dialog');
    await fill(user, 'Description', 'See customers');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(callsTo(fetch, 'PUT /api/authorities/customer%3Aview')).toBe(1));
    expect(requestTo(fetch, 'PUT /api/authorities/customer%3Aview')?.body).toEqual({
      group: 'customer',
      level: 'PLATFORM',
      description: 'See customers',
    });
  });

  it('deleteConfirmsAndRemovesRow', async () => {
    const fetch = mockFetch(routes({ 'DELETE /api/authorities/order%3Arefnd': { status: 204 } }));
    const { user } = renderApp('/authorities');
    await rowAction(user, 'order:refnd', 'Delete');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(screen.queryByText('order:refnd')).toBeNull());
    expect(callsTo(fetch, 'DELETE /api/authorities/order%3Arefnd')).toBe(1);
  });

  it('deleteInUseShowsRoles', async () => {
    mockFetch(
      routes({
        'DELETE /api/authorities/order%3Arefnd': {
          status: 409,
          body: { code: 'AUTHORITY_IN_USE', message: 'in use', roles: ['AGENT'] },
        },
      }),
    );
    const { user } = renderApp('/authorities');
    await rowAction(user, 'order:refnd', 'Delete');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText(/This authority is in a role: AGENT/)).toBeVisible();
  });

  it('historyLists', async () => {
    mockFetch(
      routes({
        'GET /api/authorities/customer%3Aview/history': {
          status: 200,
          body: [
            {
              code: 'customer:view',
              action: 'UPDATED',
              groupBefore: 'customer',
              groupAfter: 'crm',
              levelBefore: 'PLATFORM',
              levelAfter: 'PLATFORM',
              descriptionBefore: 'a',
              descriptionAfter: 'b',
              changedBy: 'root',
              at: '2026-10-20T10:00:00Z',
            },
            {
              code: 'customer:view',
              action: 'CREATED',
              groupBefore: null,
              groupAfter: 'customer',
              levelBefore: null,
              levelAfter: 'PLATFORM',
              descriptionBefore: null,
              descriptionAfter: 'a',
              changedBy: 'system',
              at: '2026-10-19T10:00:00Z',
            },
          ],
        },
      }),
    );
    const { user } = renderApp('/authorities');
    await rowAction(user, 'customer:view', 'History');
    const dialog = await screen.findByRole('dialog');
    const items = await within(dialog).findAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/root/);
    expect(items[0]).toHaveTextContent(/group customer → crm/);
    expect(items[0]).toHaveTextContent(/changed the description/);
    expect(items[0]).not.toHaveTextContent(/level/);
    expect(items[1]).toHaveTextContent(/system · created/);
  });
});
