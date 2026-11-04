import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { Rule } from '@app/api/automations';
import type { MockRoute } from '../../test/fetchMock';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { AUTOMATIONS_BASE, OPTIONS, PUBLISHED_RULE, WELCOME_RULE, automationRoutes } from '../../test/automations';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const VIEW_ONLY = { ...WORKSPACE_MANAGER, workspaces: [{ ...BRAND_A, authorities: ['automation:view'] }] };
const RULES = `${AUTOMATIONS_BASE}/rules`;
const CREATED: Rule = { ...WELCOME_RULE, id: 'r9', name: 'Welcome', version: 0 };
const CHANGE_TEXT = 'Changing the event clears the conditions and removes Add to CRM.';

function open(path: string, routes: Record<string, MockRoute> = {}, me = WORKSPACE_MANAGER) {
  const f = mockFetch({
    ...meAs(me),
    ...automationRoutes({
      [`GET ${RULES}/r1`]: { status: 200, body: WELCOME_RULE },
      [`GET ${RULES}/r2`]: { status: 200, body: PUBLISHED_RULE },
      ...routes,
    }),
  });
  return { f, ...renderApp(path, <LocationProbe />) };
}

const nameInput = () => screen.findByLabelText(/^Name/);
const card = (title: string) => within(screen.getByRole('region', { name: title }));
const cardTitles = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
const condition = (n: string) => within(screen.getByRole('group', { name: `Condition ${n}` }));
const whenToggle = () => screen.getByRole('button', { name: /^When/ });

async function chooseEvent(user: ReturnType<typeof renderApp>['user'], label: string) {
  await user.click(whenToggle());
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${label}`) }));
}

async function addAction(user: ReturnType<typeof renderApp>['user'], label: string) {
  await user.click(screen.getByRole('button', { name: 'Add action' }));
  await user.click(await screen.findByRole('menuitem', { name: new RegExp(`^${label}`) }));
}

describe('automation rule editor', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('buildsAndSavesTheWelcomeRule', async () => {
    const { f, user } = open('/automations/new', { [`POST ${RULES}`]: { status: 201, body: CREATED } });
    await user.type(await nameInput(), 'Welcome');
    expect(screen.getByRole('heading', { name: 'New rule' })).toBeVisible();
    expect(whenToggle()).toHaveTextContent('A message comes in');
    expect(screen.getByText('No conditions: every message that comes in runs this rule.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(condition('1').getByLabelText('Value')).toHaveDisplayValue('Chat is new');
    await addAction(user, 'Send template');
    await user.selectOptions(card('1. Send template').getByLabelText('Template'), 'Welcome');
    expect(
      card('1. Send template').getByText('Contact details such as the name are filled from the contact.'),
    ).toBeVisible();
    await addAction(user, 'Add to CRM');
    expect(card('2. Add to CRM').getByLabelText('Pipeline')).toHaveDisplayValue('Default pipeline');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, `POST ${RULES}`)).toBe(1));
    expect(requestTo(f, `POST ${RULES}`)?.body).toEqual({
      name: 'Welcome',
      description: null,
      event: 'MESSAGE_RECEIVED',
      priority: null,
      conditions: { combinator: 'and', not: false, rules: [{ field: 'chat.new', operator: 'is', value: true }] },
      actions: [
        { type: 'SEND_TEMPLATE', templateId: 'tp1', values: {} },
        { type: 'ADD_TO_CRM', pipelineId: null, stageId: null, dealTitle: null },
      ],
    });
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/automations/r9'));
    // the form the user built stays: the rule is not fetched again
    expect(await nameInput()).toHaveValue('Welcome');
    expect(callsTo(f, `GET ${RULES}/r9`)).toBe(0);
  });

  it('adConditionSavesABoolean', async () => {
    const { f, user } = open('/automations/new', { [`POST ${RULES}`]: { status: 201, body: CREATED } });
    await user.type(await nameInput(), 'Ads');
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.selectOptions(condition('1').getByLabelText('Field'), 'Ad');
    // a boolean field has only "is", so no operator choice is offered
    expect(condition('1').queryByLabelText('Operator')).toBeNull();
    await user.selectOptions(condition('1').getByLabelText('Value'), 'Message did not come from an ad');
    await addAction(user, 'Add to CRM');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, `POST ${RULES}`)).toBe(1));
    expect(requestTo(f, `POST ${RULES}`)?.body.conditions.rules).toEqual([
      { field: 'message.ad', operator: 'is', value: false },
    ]);
  });

  it('agentPlaceholderNeedsAValue', async () => {
    const { f, user } = open('/automations/new', { [`POST ${RULES}`]: { status: 201, body: CREATED } });
    await user.type(await nameInput(), 'Order ready');
    await addAction(user, 'Send template');
    expect(card('1. Send template').queryByLabelText(/^Value for/)).toBeNull();
    await user.selectOptions(card('1. Send template').getByLabelText('Template'), 'Order ready');
    const input = card('1. Send template').getByLabelText(/^Value for “Order id”/);
    expect(card('1. Send template').getByText('Every send uses this value.')).toBeVisible();
    expect(card('1. Send template').queryByText(/^Empty:/)).toBeNull();
    await user.type(input, 'A-17');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, `POST ${RULES}`)).toBe(1));
    expect(requestTo(f, `POST ${RULES}`)?.body.actions).toEqual([
      { type: 'SEND_TEMPLATE', templateId: 'tp2', values: { order_id: 'A-17' } },
    ]);
  });

  it('agentPlaceholderShowsItsFallback', async () => {
    const options = {
      ...OPTIONS,
      templates: [
        {
          id: 'tp3',
          name: 'Order with fallback',
          type: 'TEXT',
          placeholders: [{ name: 'order_id', kind: 'AGENT' as const, label: null, required: false, fallback: 'soon' }],
        },
      ],
    };
    const { user } = open('/automations/new', { [`GET ${AUTOMATIONS_BASE}/options`]: { status: 200, body: options } });
    await nameInput();
    await addAction(user, 'Send template');
    await user.selectOptions(card('1. Send template').getByLabelText('Template'), 'Order with fallback');
    expect(card('1. Send template').getByLabelText('Value for “order_id”')).toBeVisible();
    expect(card('1. Send template').getByText('Empty: “soon”')).toBeVisible();
  });

  it('addToCrmOnlyForMessages', async () => {
    const { user } = open('/automations/new');
    await nameInput();
    await user.click(whenToggle());
    expect(
      await screen.findByText('Runs when a deal is dragged or closed into another lane, won and lost included.'),
    ).toBeVisible();
    await user.click(screen.getByRole('option', { name: /^A deal moves to another lane/ }));
    // nothing to clear: no question
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(whenToggle()).toHaveTextContent('A deal moves to another lane');
    expect(screen.getByText('No conditions: every deal that moves to another lane runs this rule.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    expect(await screen.findByRole('menuitem', { name: /^Send template/ })).toBeVisible();
    expect(screen.getByText('Gives the chat to an agent or a team, replacing what routing did.')).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /^Assign chat/ })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: /^Add to CRM/ })).toBeNull();
  });

  it('changingEventAsksAndClears', async () => {
    const { user } = open('/automations/r1');
    expect(await nameInput()).toHaveValue('Welcome new chats');
    await chooseEvent(user, 'A deal moves to another lane');
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(CHANGE_TEXT)).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(whenToggle()).toHaveTextContent('A message comes in');
    expect(cardTitles()).toEqual(['1. Send template', '2. Assign chat', '3. Add to CRM']);
    await chooseEvent(user, 'A deal moves to another lane');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Change event' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(whenToggle()).toHaveTextContent('A deal moves to another lane');
    expect(screen.getByText('No conditions: every deal that moves to another lane runs this rule.')).toBeVisible();
    expect(cardTitles()).toEqual(['1. Send template', '2. Assign chat']);
    // nothing left to clear: the way back asks nothing
    await chooseEvent(user, 'A message comes in');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(whenToggle()).toHaveTextContent('A message comes in');
  });

  it('publishErrorsLandOnTheirAction', async () => {
    const { f, user } = open('/automations/r1', {
      [`PUT ${RULES}/r1`]: { status: 200, body: { ...WELCOME_RULE, version: 2 } },
      [`POST ${RULES}/r1/publish`]: {
        status: 400,
        body: { code: 'VALIDATION', fields: { 'actions[0].values.order_id': 'Order id needs a value' } },
      },
    });
    const name = await nameInput();
    await user.clear(name);
    await user.type(name, 'Order updates');
    await user.selectOptions(card('1. Send template').getByLabelText('Template'), 'Order ready');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await card('1. Send template').findByText('Order id needs a value')).toBeVisible();
    expect(screen.getAllByText('Order id needs a value')).toHaveLength(1);
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Order updates');
    expect(card('1. Send template').getByLabelText('Template')).toHaveDisplayValue('Order ready');
    expect(requestTo(f, `PUT ${RULES}/r1`)?.body).toMatchObject({ name: 'Order updates', version: 1 });
    expect(callsTo(f, `POST ${RULES}/r1/publish`)).toBe(1);
    expect(screen.queryByText('Published rules cannot be edited. Move the rule to draft to change it.')).toBeNull();
  });

  it('otherPublishErrorsGoToTheirPlace', async () => {
    const { user } = open('/automations/r1', {
      [`PUT ${RULES}/r1`]: { status: 200, body: WELCOME_RULE },
      [`POST ${RULES}/r1/publish`]: {
        status: 400,
        body: {
          code: 'VALIDATION',
          fields: {
            'conditions.rules[0].value': 'Choose a value',
            'actions[2].pipelineId': 'The pipeline is not active',
            'actions[1].teamId': 'The team no longer exists',
            mystery: 'is odd',
          },
        },
      },
    });
    await nameInput();
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await condition('1').findByText('Choose a value')).toBeVisible();
    expect(card('3. Add to CRM').getByText('The pipeline is not active')).toBeVisible();
    expect(card('2. Assign chat').getByText('The team no longer exists')).toBeVisible();
    expect(screen.getByText('mystery: is odd')).toBeVisible();
  });

  it('prunedAllKindsRowDoesNotShiftErrors', async () => {
    const ALL = ['TEXT', 'PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACT_CARD', 'POLL'];
    const rows: Rule = {
      ...WELCOME_RULE,
      conditions: {
        combinator: 'and',
        not: false,
        rules: [
          { field: 'chat.new', operator: 'is', value: true },
          { field: 'message.type', operator: 'is_one_of', value: ALL },
          { field: 'message.text', operator: 'contains', value: '' },
        ],
      },
    };
    const { f, user } = open('/automations/r1', {
      [`GET ${RULES}/r1`]: { status: 200, body: rows },
      [`PUT ${RULES}/r1`]: { status: 200, body: rows },
      [`POST ${RULES}/r1/publish`]: {
        status: 400,
        body: { code: 'VALIDATION', fields: { 'conditions.rules[1].value': 'Type the words to look for' } },
      },
    });
    await nameInput();
    expect(condition('2').getByLabelText('Field')).toHaveValue('message.type');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await condition('2').findByText('Type the words to look for')).toBeVisible();
    expect(condition('2').getByLabelText('Field')).toHaveValue('message.text');
    expect(screen.queryByRole('group', { name: 'Condition 3' })).toBeNull();
    expect(screen.getAllByLabelText('Field').map((el) => (el as HTMLSelectElement).value)).toEqual([
      'chat.new',
      'message.text',
    ]);
    expect(requestTo(f, `PUT ${RULES}/r1`)?.body.conditions.rules).toHaveLength(2);
  });

  it('unmatchedConditionErrorReachesTheBanner', async () => {
    const twoRows: Rule = {
      ...WELCOME_RULE,
      conditions: {
        combinator: 'and',
        not: false,
        rules: [
          { field: 'chat.new', operator: 'is', value: true },
          { field: 'message.text', operator: 'contains', value: 'price' },
        ],
      },
    };
    const { user } = open('/automations/r1', {
      [`GET ${RULES}/r1`]: { status: 200, body: twoRows },
      [`PUT ${RULES}/r1`]: { status: 200, body: twoRows },
      [`POST ${RULES}/r1/publish`]: {
        status: 400,
        body: {
          code: 'VALIDATION',
          fields: { 'conditions.rules[5].value': 'Choose a value', 'conditions.combinator': 'Choose all or any' },
        },
      },
    });
    await nameInput();
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    const banner = (await screen.findByText(/Choose a value/)).closest('.pf-v6-c-alert') as HTMLElement;
    expect(banner).toHaveClass('pf-m-danger');
    expect(banner).toHaveTextContent('Choose a value');
    expect(banner).toHaveTextContent('Choose all or any');
    expect(condition('1').queryByText(/Choose a value/)).toBeNull();
    expect(condition('2').queryByText(/Choose a value/)).toBeNull();
  });

  it('newRulePublishFailureKeepsTheFormAndUpdatesNext', async () => {
    const { f, user } = open('/automations/new', {
      [`POST ${RULES}`]: { status: 201, body: CREATED },
      [`POST ${RULES}/r9/publish`]: {
        status: 400,
        body: { code: 'VALIDATION', fields: { actions: 'Add at least one action' } },
      },
      [`PUT ${RULES}/r9`]: { status: 200, body: { ...CREATED, version: 1 } },
    });
    await user.type(await nameInput(), 'Welcome');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Add at least one action')).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/automations/r9');
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Welcome');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, `PUT ${RULES}/r9`)).toBe(1));
    expect(requestTo(f, `PUT ${RULES}/r9`)?.body).toMatchObject({ name: 'Welcome', version: 0 });
    expect(callsTo(f, `POST ${RULES}`)).toBe(1);
  });

  it('publishSucceedsAndLocks', async () => {
    const { user } = open('/automations/r1', {
      [`PUT ${RULES}/r1`]: { status: 200, body: { ...WELCOME_RULE, version: 2 } },
      [`POST ${RULES}/r1/publish`]: { status: 200, body: { ...WELCOME_RULE, version: 2, status: 'PUBLISHED' } },
    });
    await nameInput();
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(
      await screen.findByText('Published rules cannot be edited. Move the rule to draft to change it.'),
    ).toBeVisible();
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
  });

  it('testSavesThenOpensTheTestPage', async () => {
    const { f, user } = open('/automations/r1', { [`PUT ${RULES}/r1`]: { status: 200, body: WELCOME_RULE } });
    await nameInput();
    await user.click(screen.getByRole('button', { name: 'Test' }));
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/automations/r1/test'));
    expect(callsTo(f, `PUT ${RULES}/r1`)).toBe(1);
  });

  it('publishedElsewhereReloadsTheRule', async () => {
    let gets = 0;
    const { user } = open('/automations/r1', {
      [`GET ${RULES}/r1`]: () => ({
        status: 200,
        body: ++gets === 1 ? WELCOME_RULE : { ...WELCOME_RULE, status: 'PUBLISHED', version: 2 },
      }),
      [`PUT ${RULES}/r1`]: {
        status: 409,
        body: { code: 'AUTOMATION_RULE_PUBLISHED', message: 'Move the rule to draft to change it.' },
      },
    });
    await nameInput();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText('Published rules cannot be edited. Move the rule to draft to change it.'),
    ).toBeVisible();
    expect(gets).toBe(2);
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
  });

  it('publishedRuleIsReadOnlyUntilMovedToDraft', async () => {
    const { f, user } = open('/automations/r2', {
      [`POST ${RULES}/r2/unpublish`]: { status: 200, body: { ...PUBLISHED_RULE, status: 'DRAFT', version: 4 } },
    });
    expect(await nameInput()).toHaveValue('Won deals thank-you');
    expect(screen.getByText('Published rules cannot be edited. Move the rule to draft to change it.')).toBeVisible();
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(screen.getByLabelText('Priority')).toBeDisabled();
    expect(whenToggle()).toBeDisabled();
    expect(condition('1').getByLabelText('Field')).toBeDisabled();
    expect(condition('1').getByLabelText('Field')).toHaveValue('toLane.type');
    expect(card('1. Send template').getByLabelText('Template')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add action' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Test' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Move to draft' }));
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toBeEnabled());
    expect(callsTo(f, `POST ${RULES}/r2/unpublish`)).toBe(1);
    expect(callsTo(f, `GET ${RULES}/r2`)).toBe(1);
    expect(whenToggle()).toBeEnabled();
    expect(condition('1').getByLabelText('Field')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(screen.queryByText('Published rules cannot be edited. Move the rule to draft to change it.')).toBeNull();
  });

  it('viewOnlyEditorIsReadOnly', async () => {
    open('/automations/r1', {}, VIEW_ONLY);
    expect(await nameInput()).toBeDisabled();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(whenToggle()).toBeDisabled();
    expect(condition('1').getByLabelText('Field')).toBeDisabled();
    expect(card('1. Send template').getByLabelText('Template')).toBeDisabled();
    expect(card('1. Send template').getByRole('button', { name: 'Remove' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add action' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add condition' })).toBeDisabled();
    for (const label of ['Save draft', 'Publish', 'Test', 'Cancel', 'Move to draft']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('crmOffWarns', async () => {
    const options = { ...OPTIONS, crm: { enabled: false, defaultPipelineId: null, pipelines: [] } };
    open('/automations/r1', { [`GET ${AUTOMATIONS_BASE}/options`]: { status: 200, body: options } });
    await nameInput();
    expect(
      card('3. Add to CRM').getByText('CRM is off for this brand. The rule cannot be published with this action.'),
    ).toBeVisible();
    expect(card('3. Add to CRM').queryByLabelText('Pipeline')).toBeNull();
  });

  it('addToCrmLanesFollowThePipeline', async () => {
    const { f, user } = open('/automations/new', { [`POST ${RULES}`]: { status: 201, body: CREATED } });
    await user.type(await nameInput(), 'Leads');
    await addAction(user, 'Add to CRM');
    const crm = card('1. Add to CRM');
    expect(crm.getByLabelText('Lane')).toBeDisabled();
    await user.selectOptions(crm.getByLabelText('Pipeline'), 'Sales');
    expect(
      within(crm.getByLabelText('Lane'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['First lane', 'New', 'Proposal sent', 'Won', 'Lost']);
    await user.selectOptions(crm.getByLabelText('Lane'), 'Proposal sent');
    expect(crm.getByLabelText('Deal title')).toHaveAttribute('placeholder', '{{name}} – WhatsApp');
    expect(
      crm.getByText(
        "{{name}} is the contact's name, or their number when there is none. The owner is whoever the chat is assigned to when this runs.",
      ),
    ).toBeVisible();
    await user.type(crm.getByLabelText('Deal title'), 'New lead');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, `POST ${RULES}`)).toBe(1));
    expect(requestTo(f, `POST ${RULES}`)?.body.actions).toEqual([
      { type: 'ADD_TO_CRM', pipelineId: 'p1', stageId: 's2', dealTitle: 'New lead' },
    ]);
  });

  it('moveUpReorders', async () => {
    const { f, user } = open('/automations/r1', { [`PUT ${RULES}/r1`]: { status: 200, body: WELCOME_RULE } });
    await nameInput();
    expect(card('1. Send template').getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(card('3. Add to CRM').getByRole('button', { name: 'Move down' })).toBeDisabled();
    expect(card('2. Assign chat').getByText('Round robin in Support')).toBeVisible();
    await user.click(card('2. Assign chat').getByRole('button', { name: 'Move up' }));
    expect(cardTitles()).toEqual(['1. Assign chat', '2. Send template', '3. Add to CRM']);
    await user.click(card('3. Add to CRM').getByRole('button', { name: 'Remove' }));
    expect(cardTitles()).toEqual(['1. Assign chat', '2. Send template']);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, `PUT ${RULES}/r1`)).toBe(1));
    const body = requestTo(f, `PUT ${RULES}/r1`)?.body;
    expect(body.actions.map((a: { type: string }) => a.type)).toEqual(['ASSIGN_CHAT', 'SEND_TEMPLATE']);
    expect(body).toMatchObject({ version: 1, priority: 1, name: 'Welcome new chats' });
  });
});
