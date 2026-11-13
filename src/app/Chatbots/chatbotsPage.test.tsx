import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { CHATBOTS_BASE, LEAD_QUALIFIER, SUMMARIES, chatbotRoutes } from '../../test/chatbots';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { EMPTY_TEXT } from '@app/Chatbots/ChatbotsPage';

const VIEW_ONLY = { ...WORKSPACE_MANAGER, workspaces: [{ ...BRAND_A, authorities: ['chatbot:view'] }] };

async function rowFor(name: string): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name });
  return link.closest('tr') as HTMLElement;
}

describe('chatbots list', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('listsChatbots', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes() });
    renderApp('/chatbots');
    expect(await screen.findByRole('heading', { name: 'Chatbots' })).toBeVisible();
    const row = within(await rowFor('Price bot'));
    expect(row.getByText('Published')).toBeVisible();
    const cells = row.getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toContain('12');
    expect(cells).toContain('2');
    const draft = within(await rowFor('Lead qualifier'));
    expect(draft.getByText('Draft')).toBeVisible();
    expect(draft.getByText('Never')).toBeVisible();
  });

  it('showsTheEmptyState', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes({ [`GET ${CHATBOTS_BASE}`]: { status: 200, body: [] } }) });
    renderApp('/chatbots');
    expect(await screen.findByText(EMPTY_TEXT)).toBeVisible();
  });

  it('newChatbotCreatesAndOpensEditor', async () => {
    const fetch = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...chatbotRoutes({ [`POST ${CHATBOTS_BASE}`]: { status: 201, body: { ...LEAD_QUALIFIER, id: 'c9', name: 'Price bot 2' } } }),
    });
    const { user } = renderApp('/chatbots', <LocationProbe />);
    await user.click(await screen.findByRole('button', { name: 'New chatbot' }));
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Price bot 2');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(requestTo(fetch, `POST ${CHATBOTS_BASE}`)?.body).toEqual({ name: 'Price bot 2' });
    expect(await screen.findByLabelText('Location')).toHaveTextContent('/chatbots/c9');
  });

  it('deleteAsksThenDeletes', async () => {
    const fetch = mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes({ [`DELETE ${CHATBOTS_BASE}/c1`]: { status: 204 } }) });
    const { user } = renderApp('/chatbots');
    await user.click(within(await rowFor('Lead qualifier')).getByRole('button', { name: 'Actions for Lead qualifier' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(await screen.findByText(/Delete “Lead qualifier”/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(callsTo(fetch, `DELETE ${CHATBOTS_BASE}/c1`)).toBe(1));
    expect(callsTo(fetch, `GET ${CHATBOTS_BASE}`)).toBeGreaterThanOrEqual(2);
  });

  it('publishedHasNoDelete', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes() });
    const { user } = renderApp('/chatbots');
    await user.click(within(await rowFor('Price bot')).getByRole('button', { name: 'Actions for Price bot' }));
    expect(await screen.findByRole('menuitem', { name: 'Runs' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
  });

  it('viewerSeesNoNewButton', async () => {
    mockFetch({ ...meAs(VIEW_ONLY), ...chatbotRoutes() });
    renderApp('/chatbots');
    expect(await screen.findByRole('heading', { name: 'Chatbots' })).toBeVisible();
    await screen.findByRole('link', { name: 'Lead qualifier' });
    expect(screen.queryByRole('button', { name: 'New chatbot' })).toBeNull();
  });
});
