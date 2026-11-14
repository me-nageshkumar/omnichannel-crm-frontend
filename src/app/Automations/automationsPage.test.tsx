import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import {
  AUTOMATIONS_BASE,
  PUBLISHED_RULE,
  RULE_SUMMARIES,
  WELCOME_RULE,
  automationRoutes,
} from '../../test/automations';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const VIEW_ONLY = { ...WORKSPACE_MANAGER, workspaces: [{ ...BRAND_A, authorities: ['automation:view'] }] };

const SUMMARY = {
  ...RULE_SUMMARIES[0],
  name: 'Welcome',
  priority: null,
  actionsSummary: 'Send “Welcome” · Round robin in Support · Add to CRM (default pipeline)',
  runs7d: 3,
  failures7d: 1,
};
const LIST = [SUMMARY, RULE_SUMMARIES[1]];

const listRoute = (items = LIST) => ({ [`GET ${AUTOMATIONS_BASE}/rules`]: { status: 200, body: items } });

async function rowFor(name: string): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name });
  return link.closest('tr') as HTMLElement;
}

/** The summary once it has faded in (the tooltip waits its entry delay before showing). */
async function shownTip(): Promise<HTMLElement> {
  const tip = await screen.findByRole('tooltip');
  await waitFor(() => expect(tip).toBeVisible(), { timeout: 2000 });
  return tip;
}

describe('rules list', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('listsRulesWithStats', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute()) });
    renderApp('/automations');
    const row = within(await rowFor('Welcome'));
    expect(row.getByText('Send “Welcome” · Round robin in Support · Add to CRM (default pipeline)')).toBeVisible();
    expect(row.getByText('Draft')).toBeVisible();
    expect(row.getByText('—')).toBeVisible();
    expect(row.getByText('Never')).toBeVisible();
    const cells = row.getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toContain('3');
    expect(cells).toContain('1');
    expect(screen.getByRole('tab', { name: 'Rules' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Event history' })).toBeVisible();
  });

  it('hoverShowsTheRuleInWords', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute()) });
    const { user } = renderApp('/automations');
    const link = await screen.findByRole('link', { name: 'Welcome' });
    await user.hover(link);
    const tip = await shownTip();
    expect(within(tip).getByText('Welcome')).toBeVisible();
    expect(within(tip).getByText('When a message comes in')).toBeVisible();
    expect(within(tip).getByText('If all of these:')).toBeVisible();
    expect(within(tip).getByText('Chat is new')).toBeVisible();
    expect(within(tip).getByText('1. Send “Welcome”')).toBeVisible();
    // read out with the link, never a modal dialog
    expect(link).toHaveAttribute('aria-describedby', tip.id);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('focusOpensTheSummary', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute()) });
    const { user } = renderApp('/automations');
    await screen.findByRole('link', { name: 'Won deals thank-you' });
    while (document.activeElement?.textContent !== 'Won deals thank-you') await user.tab();
    const tip = await shownTip();
    expect(within(tip).getByText('No conditions: every deal that moves to another lane runs this rule.')).toBeVisible();
    expect(within(tip).getByText('Then: nothing yet')).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('optionsFailingStillShowsTheListAndRawValues', async () => {
    const withNumber = {
      ...SUMMARY,
      conditions: { combinator: 'and' as const, not: false, rules: [{ field: 'number', operator: 'is', value: 'n1' }] },
    };
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...automationRoutes(listRoute([withNumber])),
      [`GET ${AUTOMATIONS_BASE}/options`]: { status: 500, body: { message: 'boom' } },
    });
    const { user } = renderApp('/automations');
    await user.hover(await screen.findByRole('link', { name: 'Welcome' }));
    expect(within(await shownTip()).getByText('Number is n1')).toBeVisible();
  });

  it('aMalformedRuleDoesNotBlankTheList', async () => {
    const broken = {
      ...SUMMARY,
      conditions: { combinator: 'and', not: false, rules: [null] },
      actions: [null],
    } as unknown as typeof SUMMARY;
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute([broken, RULE_SUMMARIES[1]])) });
    const { user } = renderApp('/automations');
    expect(await screen.findByRole('link', { name: 'Won deals thank-you' })).toBeVisible();
    await user.hover(screen.getByRole('link', { name: 'Welcome' }));
    expect(within(await shownTip()).getByText('Unknown condition')).toBeVisible();
  });

  it('nestingIsAListInAList', async () => {
    const nested = {
      ...SUMMARY,
      conditions: {
        combinator: 'or' as const,
        not: false,
        rules: [
          { field: 'chat.new', operator: 'is', value: true },
          {
            combinator: 'and' as const,
            not: false,
            rules: [
              { field: 'chat.new', operator: 'is', value: false },
              {
                combinator: 'or' as const,
                not: false,
                rules: [
                  { field: 'contact.inCrm', operator: 'is', value: true },
                  { field: 'message.ad', operator: 'is', value: true },
                ],
              },
            ],
          },
        ],
      },
    };
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute([nested])) });
    const { user } = renderApp('/automations');
    await user.hover(await screen.findByRole('link', { name: 'Welcome' }));
    const tip = await shownTip();
    const ifItem = within(tip).getByText('If any of these:').closest('li') as HTMLElement;
    const allItem = within(ifItem).getByText('all of these:').closest('li') as HTMLElement;
    // the group's own conditions sit in a list inside its item, one level per group
    expect(
      within(within(allItem).getByRole('list'))
        .getAllByRole('listitem')
        .map((li) => li.firstChild?.textContent),
    ).toEqual(['Chat is existing', 'any of these: Contact is in the CRM; Message came from an ad']);
  });

  it('shows the empty state', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute([])) });
    renderApp('/automations');
    expect(
      await screen.findByText(
        'No rules yet. A rule sends a template, assigns the chat or adds the person to the CRM when a message comes in or a deal moves.',
      ),
    ).toBeVisible();
  });

  it('New rule goes to /automations/new', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute()) });
    const { user } = renderApp('/automations', <LocationProbe />);
    await user.click(await screen.findByRole('link', { name: 'New rule' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/automations/new');
  });

  it('publishFromTheList', async () => {
    let published = false;
    const fetchFn = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...automationRoutes({
        [`GET ${AUTOMATIONS_BASE}/rules`]: () => ({
          status: 200,
          body: [{ ...SUMMARY, status: published ? 'PUBLISHED' : 'DRAFT' }],
        }),
        [`POST ${AUTOMATIONS_BASE}/rules/r1/publish`]: () => {
          published = true;
          return { status: 200, body: { ...WELCOME_RULE, status: 'PUBLISHED' } };
        },
      }),
    });
    const { user } = renderApp('/automations');
    const row = within(await rowFor('Welcome'));
    await user.click(row.getByRole('button', { name: 'Actions for Welcome' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Publish' }));
    expect(await within(await rowFor('Welcome')).findByText('Published')).toBeVisible();
    expect(requestTo(fetchFn, `POST ${AUTOMATIONS_BASE}/rules/r1/publish`)).toBeDefined();
  });

  it('publishErrorsAreListed', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...automationRoutes({
        ...listRoute(),
        [`POST ${AUTOMATIONS_BASE}/rules/r1/publish`]: {
          status: 400,
          body: { code: 'VALIDATION', fields: { 'actions[0].templateId': 'The template is archived' } },
        },
      }),
    });
    const { user } = renderApp('/automations');
    const row = within(await rowFor('Welcome'));
    await user.click(row.getByRole('button', { name: 'Actions for Welcome' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Publish' }));
    const alert = await screen.findByText(/Welcome cannot be published/);
    const box = alert.closest('.pf-v6-c-alert') as HTMLElement;
    expect(within(box).getByText('The template is archived')).toBeVisible();
    expect(within(box).getByRole('link', { name: 'Open the rule' })).toHaveAttribute('href', '/automations/r1');
  });

  it('deleteAsksFirst', async () => {
    let deleted = false;
    const fetchFn = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...automationRoutes({
        [`GET ${AUTOMATIONS_BASE}/rules`]: () => ({ status: 200, body: deleted ? [RULE_SUMMARIES[1]] : LIST }),
        [`DELETE ${AUTOMATIONS_BASE}/rules/r1`]: () => {
          deleted = true;
          return { status: 204 };
        },
      }),
    });
    const { user } = renderApp('/automations');
    const row = within(await rowFor('Welcome'));
    await user.click(row.getByRole('button', { name: 'Actions for Welcome' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete rule “Welcome”?')).toBeVisible();
    expect(within(dialog).getByText('Its runs stay in the history.')).toBeVisible();
    expect(requestTo(fetchFn, `DELETE ${AUTOMATIONS_BASE}/rules/r1`)).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(screen.queryByRole('link', { name: 'Welcome' })).toBeNull());
    expect(requestTo(fetchFn, `DELETE ${AUTOMATIONS_BASE}/rules/r1`)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Won deals thank-you' })).toBeVisible();
  });

  it('publishedRuleHasNoDelete', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute()) });
    const { user } = renderApp('/automations');
    const row = within(await rowFor(PUBLISHED_RULE.name));
    await user.click(row.getByRole('button', { name: `Actions for ${PUBLISHED_RULE.name}` }));
    expect(await screen.findByRole('menuitem', { name: 'Move to draft' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Runs' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Test' })).toBeNull();
  });

  it('viewOnlyUserSeesNoChanges', async () => {
    mockFetch({ ...meAs(VIEW_ONLY), ...automationRoutes(listRoute()) });
    const { user } = renderApp('/automations');
    const row = within(await rowFor('Welcome'));
    expect(screen.queryByRole('link', { name: 'New rule' })).toBeNull();
    await user.click(row.getByRole('button', { name: 'Actions for Welcome' }));
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(items).toEqual(['View', 'Runs']);
  });

  it('kebab navigation items move the router without a page load', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute()) });
    const { user } = renderApp('/automations', <LocationProbe />);
    const open = async () => {
      const row = within(await rowFor('Welcome'));
      await user.click(row.getByRole('button', { name: 'Actions for Welcome' }));
    };
    await open();
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/automations/r1');
    expect(screen.getByLabelText('Location')).not.toHaveTextContent('/automations/r1/');
  });

  it('kebab Runs and Test go to their routes', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...automationRoutes(listRoute()) });
    const { user } = renderApp('/automations', <LocationProbe />);
    const row = within(await rowFor('Welcome'));
    await user.click(row.getByRole('button', { name: 'Actions for Welcome' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Test' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/automations/r1/test');
  });
});
