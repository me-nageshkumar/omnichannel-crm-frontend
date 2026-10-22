import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { RuleGroup } from '@app/api/contacts';
import type { CurrentUser } from '@app/api/users';
import { LocationProbe, renderApp } from '../../../test/renderApp';
import { MockRoute, callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { gate } from '../../../test/gate';
import { AGENT_IN_BRAND, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { fill, rowWith } from '../../../test/admin';
import {
  LAPSED_QUERY,
  LAPSED_TREE,
  advancedFilter,
  attribute,
  contact,
  filterPreview,
  label,
  savedFilter,
} from '../../../test/contacts';

type User = ReturnType<typeof renderApp>['user'];

const B = '/api/workspaces/w1';
const PREVIEW = `POST ${B}/contact-filters/preview`;
const CREATE = `POST ${B}/contact-filters`;
const VIP = label({ id: 'l1', name: 'VIP', color: 'purple' });
const LEAD = label({ id: 'l2', name: 'Lead' });
const CITY = attribute({ id: 'a1', name: 'City' });
const ASHA = contact({ id: 'c1', name: 'Asha Rao', phone: '919900000001', labels: ['l1'] });
const SIMPLE = savedFilter({ id: 'f1', name: 'Jaipur VIPs', filter: { labelsAny: ['l1'] } });

const ONE: RuleGroup = { combinator: 'and', not: false, rules: [{ field: 'labels', operator: 'has', value: 'l1' }] };
const TWO: RuleGroup = {
  ...ONE,
  rules: [...ONE.rules, { field: 'lastMessageAt', operator: 'before', value: '2026-09-01' }],
};

function routes(user: CurrentUser = WORKSPACE_MANAGER, extra: Record<string, MockRoute> = {}) {
  return {
    ...meAs(user),
    [`GET ${B}/contact-labels`]: { status: 200, body: [VIP, LEAD] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [CITY] },
    [PREVIEW]: { status: 200, body: filterPreview({ sample: [ASHA] }) },
    [CREATE]: { status: 201, body: advancedFilter({ id: 'f9', name: 'Lapsed VIPs' }) },
    [`GET ${B}/contact-filters/f2`]: { status: 200, body: advancedFilter({ id: 'f2', name: 'Lapsed VIPs' }) },
    // The Contacts page, which a simple filter opens.
    [`POST ${B}/contacts/search`]: { status: 200, body: { items: [ASHA], total: 1, page: 0 } },
    [`GET ${B}/contact-filters`]: { status: 200, body: [SIMPLE] },
    ...extra,
  };
}

const rule = (n: string) => within(screen.getByRole('group', { name: n }));
const button = (n: string) => screen.getByRole('button', { name: n });
const tab = (n: string) => screen.getByRole('tab', { name: n });
const location = () => screen.getByRole('status', { name: 'Location' }).textContent;
const codeText = () => screen.getByRole('code').textContent;

function open(path: string) {
  return renderApp(path, <LocationProbe />);
}

async function buildOne(user: User) {
  await screen.findByRole('group', { name: 'Rule 1' });
  await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Labels');
  await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'VIP');
}

async function buildTwo(user: User) {
  await buildOne(user);
  await user.click(
    within(screen.getByRole('toolbar', { name: 'Filter rules actions' })).getByRole('button', { name: 'Add rule' }),
  );
  await user.selectOptions(rule('Rule 2').getByLabelText('Field'), 'Last message');
  await user.selectOptions(rule('Rule 2').getByLabelText('Operator'), 'is before');
  fireEvent.change(rule('Rule 2').getByLabelText('Value'), { target: { value: '2026-09-01' } });
}

const leftFor = async (path: string) => waitFor(() => expect(location()).toBe(path));

describe('filter builder', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('builderIsNotFoundWithoutBulk', async () => {
    const fetch = mockFetch(routes(AGENT_IN_BRAND));
    const first = open('/contacts/filters/new');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
    first.unmount();

    open('/contacts/filters/f2');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
    expect(callsTo(fetch, `GET ${B}/contact-filters/f2`)).toBe(0);
    expect(callsTo(fetch, PREVIEW)).toBe(0);
  });

  it('checkAndSampleNeedACompleteTree', async () => {
    mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await screen.findByRole('group', { name: 'Rule 1' });
    expect(button('Check count')).toBeDisabled();
    expect(button('Show sample')).toBeDisabled();
    expect(button('Save')).toBeDisabled();

    await buildOne(user);
    expect(button('Check count')).toBeEnabled();
    expect(button('Show sample')).toBeEnabled();
    expect(button('Save')).toBeDisabled();

    await fill(user, 'Name', 'Lapsed VIPs');
    expect(button('Save')).toBeEnabled();

    await user.click(rule('Rule 1').getByRole('button', { name: 'Remove rule' }));
    expect(button('Check count')).toBeDisabled();
    expect(button('Show sample')).toBeDisabled();
    expect(button('Save')).toBeDisabled();
  });

  it('checkCountSendsTheTree', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await user.click(button('Check count'));
    expect(await screen.findByText('1,204 contacts')).toBeVisible();
    expect(requestTo(fetch, PREVIEW)?.body).toEqual({ rules: ONE });
  });

  it('showSampleListsTheContacts', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await user.click(button('Show sample'));
    const table = await screen.findByRole('grid', { name: 'Sample contacts' });
    expect(requestTo(fetch, PREVIEW)?.body).toEqual({ rules: ONE, sample: 10 });
    const row = within(table).getByText('Asha Rao').closest('tr') as HTMLElement;
    expect(within(row).getByText('+919900000001')).toBeVisible();
    expect(within(row).getByText('VIP')).toBeVisible();
  });

  it('queryTabShowsTheCompiledQuery', async () => {
    mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await screen.findByRole('group', { name: 'Rule 1' });
    await user.click(tab('Query'));
    expect(screen.getByText('Check the count to see the query.')).toBeVisible();

    await user.click(tab('Rules'));
    await buildOne(user);
    await user.click(button('Check count'));
    await screen.findByText('1,204 contacts');
    await user.click(tab('Query'));
    expect(codeText()).toBe(JSON.stringify(LAPSED_QUERY, null, 2));
  });

  it('saveSendsNameAndRules', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await fill(user, 'Name', 'Lapsed VIPs');
    await buildTwo(user);
    await user.click(button('Save'));
    await leftFor('/contacts/filters');
    expect(requestTo(fetch, PREVIEW)?.body).toEqual({ rules: TWO });
    expect(requestTo(fetch, CREATE)?.body).toEqual({ name: 'Lapsed VIPs', rules: TWO });
  });

  it('saveAfterCheckDoesNotPreviewAgain', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await fill(user, 'Name', 'Lapsed VIPs');
    await user.click(button('Check count'));
    await screen.findByText('1,204 contacts');
    await user.click(button('Save'));
    await leftFor('/contacts/filters');
    expect(callsTo(fetch, PREVIEW)).toBe(1);
    expect(callsTo(fetch, CREATE)).toBe(1);
  });

  it('saveRePreviewsAChangedTree', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await fill(user, 'Name', 'Lapsed VIPs');
    await user.click(button('Check count'));
    await screen.findByText('1,204 contacts');
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'Lead');
    expect(screen.queryByText('1,204 contacts')).not.toBeInTheDocument();

    await user.click(button('Save'));
    await leftFor('/contacts/filters');
    expect(callsTo(fetch, PREVIEW)).toBe(2);
    const sent = requestTo(fetch, PREVIEW, 1)?.body.rules;
    expect(sent.rules[0].value).toBe('l2');
    expect(requestTo(fetch, CREATE)?.body.rules).toEqual(sent);
  });

  it('aStalePreviewDoesNotCountForTheNewTree', async () => {
    const fetch = mockFetch(routes());
    const held = gate(fetch, PREVIEW, 1);
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await fill(user, 'Name', 'Lapsed VIPs');
    await user.click(button('Check count'));
    await waitFor(() => expect(callsTo(fetch, PREVIEW)).toBe(1));
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'Lead');
    held.release();
    await waitFor(() => expect(button('Check count')).toBeEnabled());
    expect(screen.queryByText('1,204 contacts')).not.toBeInTheDocument();

    await user.click(button('Save'));
    await leftFor('/contacts/filters');
    expect(callsTo(fetch, PREVIEW)).toBe(2);
  });

  it('previewTimeoutShowsTheSentenceAndDoesNotSave', async () => {
    const fetch = mockFetch(routes(WORKSPACE_MANAGER, { [PREVIEW]: { status: 504, body: { code: 'QUERY_TIMEOUT' } } }));
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await fill(user, 'Name', 'Lapsed VIPs');
    await user.click(button('Save'));
    expect(await screen.findByText('This filter takes too long to run. Make it more specific.')).toBeVisible();
    expect(callsTo(fetch, CREATE)).toBe(0);
    expect(location()).toBe('/contacts/filters/new');
  });

  it('validationErrorShowsUnderTheRule', async () => {
    mockFetch(
      routes(WORKSPACE_MANAGER, {
        [PREVIEW]: { status: 400, body: { code: 'VALIDATION', fields: { 'rules[1].value': 'must be a date' } } },
      }),
    );
    const { user } = open('/contacts/filters/new');
    await buildTwo(user);
    await user.click(button('Check count'));
    expect(await rule('Rule 2').findByText('must be a date')).toBeVisible();
    expect(rule('Rule 1').queryByText('must be a date')).not.toBeInTheDocument();
  });

  it('duplicateNameShowsUnderName', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, { [CREATE]: { status: 409, body: { code: 'DUPLICATE', field: 'name' } } }));
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await fill(user, 'Name', 'Lapsed VIPs');
    await user.click(button('Save'));
    expect(await screen.findByText('Name is already in use.')).toBeVisible();
    expect(location()).toBe('/contacts/filters/new');
  });

  it('editLoadsTheFilterAndPuts', async () => {
    const PUT = `PUT ${B}/contact-filters/f2`;
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, { [PUT]: { status: 200, body: advancedFilter({ id: 'f2', name: 'Lapsed VIPs 2' }) } }),
    );
    const { user } = open('/contacts/filters/f2');
    expect(await screen.findByRole('heading', { name: 'Edit filter' })).toBeVisible();
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('Lapsed VIPs');
    expect(rule('Rule 1').getByLabelText('Field')).toHaveValue('labels');
    await user.click(tab('Query'));
    expect(codeText()).toBe(JSON.stringify(LAPSED_QUERY, null, 2));

    await fill(user, 'Name', 'Lapsed VIPs 2');
    await user.click(button('Save'));
    await leftFor('/contacts/filters');
    expect(requestTo(fetch, PREVIEW)?.body).toEqual({ rules: LAPSED_TREE });
    expect(requestTo(fetch, PUT)?.body).toEqual({ name: 'Lapsed VIPs 2', rules: LAPSED_TREE });
  });

  it('missingAttributeBlocksSave', async () => {
    const gone = advancedFilter({
      id: 'f3',
      name: 'Gone',
      rules: {
        combinator: 'and',
        not: false,
        rules: [
          { field: 'attributes.a9', operator: 'is', value: 'x' },
          { field: 'labels', operator: 'has', value: 'l9' },
        ],
      },
    });
    mockFetch(routes(WORKSPACE_MANAGER, { [`GET ${B}/contact-filters/f3`]: { status: 200, body: gone } }));
    const { user } = open('/contacts/filters/f3');
    await screen.findByRole('group', { name: 'Rule 1' });
    expect(rule('Rule 1').getByText('Missing attribute')).toBeVisible();
    expect(rule('Rule 2').getByText('Missing label')).toBeVisible();
    expect(button('Save')).toBeDisabled();
    expect(button('Check count')).toBeDisabled();

    await user.click(rule('Rule 1').getByRole('button', { name: 'Remove rule' }));
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'VIP');
    expect(button('Save')).toBeEnabled();
    expect(button('Check count')).toBeEnabled();
  });

  it('simpleFilterOpensTheContactsPage', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, { [`GET ${B}/contact-filters/f1`]: { status: 200, body: SIMPLE } }));
    open('/contacts/filters/f1');
    expect(await screen.findByRole('heading', { name: 'Contacts' })).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Saved filter: Jaipur VIPs' })).toBeVisible();
    await rowWith('Asha Rao');
  });

  it('cancelLeavesWithoutSaving', async () => {
    const fetch = mockFetch(routes());
    const { user } = open('/contacts/filters/new');
    await buildOne(user);
    await fill(user, 'Name', 'Lapsed VIPs');
    await user.click(button('Cancel'));
    await leftFor('/contacts/filters');
    expect(callsTo(fetch, CREATE)).toBe(0);
  });
});
