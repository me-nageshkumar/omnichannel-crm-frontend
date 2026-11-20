import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { AutomationOptions, Rule } from '@app/api/automations';
import { actionSummary } from '@app/Automations/automationModel';
import type { MockRoute } from '../../test/fetchMock';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { renderApp } from '../../test/renderApp';
import { AUTOMATIONS_BASE, OPTIONS, WELCOME_RULE, automationRoutes } from '../../test/automations';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const RULES = `${AUTOMATIONS_BASE}/rules`;
const CREATED: Rule = { ...WELCOME_RULE, id: 'r9', name: 'Follow up', version: 0 };

const WITH_CLOUD: AutomationOptions = {
  ...OPTIONS,
  cloudTemplates: [
    {
      id: 'ct1',
      name: 'course_follow_up',
      language: 'en',
      phoneNumberIds: ['n3'],
      variables: [
        { key: 'body:1', component: 'BODY', index: 0, example: 'Veenu' },
        { key: 'body:2', component: 'BODY', index: 1, example: 'BCA' },
      ],
      fills: { 'body:1': { kind: 'CONTACT_FIELD', attributeKey: 'name' } },
    },
  ],
};

function open(options: AutomationOptions, routes: Record<string, MockRoute> = {}) {
  const f = mockFetch({
    ...meAs(WORKSPACE_MANAGER),
    ...automationRoutes({ [`GET ${AUTOMATIONS_BASE}/options`]: { status: 200, body: options }, ...routes }),
  });
  return { f, ...renderApp('/automations/new') };
}

const card = (title: string) => within(screen.getByRole('region', { name: title }));

describe('Send WhatsApp template rule action', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('addsActionWithValues', async () => {
    const { f, user } = open(WITH_CLOUD, { [`POST ${RULES}`]: { status: 201, body: CREATED } });
    await user.type(await screen.findByLabelText(/^Name/), 'Follow up');
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    await user.click(await screen.findByRole('menuitem', { name: /^Send WhatsApp template/ }));
    await user.selectOptions(
      card('1. Send WhatsApp template').getByLabelText('WhatsApp template'),
      'course_follow_up (en)',
    );
    expect(card('1. Send WhatsApp template').getByText('Empty: the contact name')).toBeVisible();
    await user.type(card('1. Send WhatsApp template').getByLabelText(/^Value for “body:2”/), 'BCA');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, `POST ${RULES}`)).toBe(1));
    expect(requestTo(f, `POST ${RULES}`)?.body.actions).toEqual([
      { type: 'SEND_CLOUD_TEMPLATE', cloudTemplateId: 'ct1', values: { 'body:2': 'BCA' } },
    ]);
  });

  it('filledVariablesOptional', async () => {
    const { user } = open(WITH_CLOUD);
    await screen.findByLabelText(/^Name/);
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    await user.click(await screen.findByRole('menuitem', { name: /^Send WhatsApp template/ }));
    await user.selectOptions(
      card('1. Send WhatsApp template').getByLabelText('WhatsApp template'),
      'course_follow_up (en)',
    );
    expect(card('1. Send WhatsApp template').getByLabelText(/^Value for “body:1”/)).not.toBeRequired();
    expect(
      card('1. Send WhatsApp template')
        .getByText(/^Value for “body:2”/)
        .closest('label')?.textContent,
    ).toContain('*');
  });

  it('summaryNamesTemplate', () => {
    expect(actionSummary({ type: 'SEND_CLOUD_TEMPLATE', cloudTemplateId: 'ct1', values: {} }, WITH_CLOUD)).toBe(
      'Send WhatsApp template “course_follow_up”',
    );
  });

  it('notOfferedWithoutCloudTemplates', async () => {
    const { user } = open({ ...OPTIONS, cloudTemplates: [] });
    await screen.findByLabelText(/^Name/);
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    const items = (await screen.findAllByRole('menuitem')).map((m) => m.textContent ?? '');
    expect(items.some((t) => t.startsWith('Send WhatsApp template'))).toBe(false);
  });

  it('noCloudTemplatesShowsHint', async () => {
    const rule: Rule = {
      ...WELCOME_RULE,
      actions: [{ type: 'SEND_CLOUD_TEMPLATE', cloudTemplateId: 'gone', values: {} }],
    };
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...automationRoutes({
        [`GET ${AUTOMATIONS_BASE}/options`]: { status: 200, body: { ...OPTIONS, cloudTemplates: [] } },
        [`GET ${RULES}/r1`]: { status: 200, body: rule },
      }),
    });
    renderApp('/automations/r1');
    expect(
      await screen.findByText('No approved WhatsApp templates yet — sync them on WhatsApp templates'),
    ).toBeVisible();
  });
});
