import '../../test/reactFlowStub';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { MockRoute } from '../../test/fetchMock';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { CHATBOTS_BASE, LEAD_QUALIFIER, chatbotRoutes } from '../../test/chatbots';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { PUBLISHED_TEXT } from '@app/Chatbots/ChatbotEditorPage';

function open(path: string, routes: Record<string, MockRoute> = {}) {
  const f = mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes(routes) });
  return { f, ...renderApp(path, <LocationProbe />) };
}

// cards are the named list items; the output lists inside them are unnamed
const nodes = () => ({
  items: () => within(screen.getByRole('list', { name: 'Nodes' })).getAllByRole('listitem', { name: /./ }),
});
const nodeItem = (name: string) => within(screen.getByRole('listitem', { name }));

describe('chatbot editor', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('rendersNodesAndEntryTag', async () => {
    open('/chatbots/c1');
    expect(await screen.findByRole('heading', { name: 'Lead qualifier' })).toBeVisible();
    expect(nodes().items()).toHaveLength(3);
    expect(nodeItem('Welcome').getByText('Entry')).toBeVisible();
    expect(nodeItem('AskBudget').queryByText('Entry')).toBeNull();
    expect(nodeItem('Welcome').getByText('Yes')).toBeVisible();
    expect(nodeItem('Welcome').getByText('Other reply')).toBeVisible();
  });

  it('saveSendsPrunedFlowAndShowsProblems', async () => {
    const { f, user } = open('/chatbots/c1', {
      [`PUT ${CHATBOTS_BASE}/c1`]: {
        status: 200,
        body: {
          chatbot: { ...LEAD_QUALIFIER, version: 4 },
          problems: [
            {
              nodeId: 'n2',
              nodeName: 'AskBudget',
              field: 'settings.text',
              message: 'is required',
              severity: 'WARNING',
            },
          ],
        },
      },
    });
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(nodeItem('AskBudget').getByRole('button', { name: 'Rename AskBudget' }));
    const input = await screen.findByRole('textbox', { name: 'Node name' });
    await user.clear(input);
    await user.type(input, 'Budget{Enter}');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(f, `PUT ${CHATBOTS_BASE}/c1`)).toBe(1));
    const body = requestTo(f, `PUT ${CHATBOTS_BASE}/c1`)?.body;
    expect(body.version).toBe(3);
    expect(body.flow.nodes).toHaveLength(3);
    expect(body.flow.nodes[1].data.name).toBe('Budget');
    expect(body.flow.nodes[2].data.settings.message.text.body).toBe('Great, {{Budget.answer}} it is');
    expect(await screen.findByRole('button', { name: '1 problem' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('ctrlSSaves', async () => {
    const { f, user } = open('/chatbots/c1', {
      [`PUT ${CHATBOTS_BASE}/c1`]: { status: 200, body: { chatbot: LEAD_QUALIFIER, problems: [] } },
    });
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(nodeItem('AskBudget').getByRole('button', { name: 'Rename AskBudget' }));
    const input = await screen.findByRole('textbox', { name: 'Node name' });
    await user.clear(input);
    await user.type(input, 'Budget{Enter}');
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    await waitFor(() => expect(callsTo(f, `PUT ${CHATBOTS_BASE}/c1`)).toBe(1));
  });

  it('publishErrorSelectsNode', async () => {
    const { user } = open('/chatbots/c1', {
      [`POST ${CHATBOTS_BASE}/c1/publish`]: {
        status: 400,
        body: { code: 'VALIDATION', message: 'invalid', fields: { 'nodes.n2.settings.text': 'is required' } },
      },
    });
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('dialog', { name: 'AskBudget' })).toBeVisible();
    // once in the drawer's problem list, once under the Question field
    expect(within(screen.getByRole('dialog', { name: 'AskBudget' })).getAllByText('is required')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '1 problem' })).toBeVisible();
  });

  it('publishedIsReadOnly', async () => {
    open('/chatbots/c2');
    expect(await screen.findByText(PUBLISHED_TEXT)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Move to draft' })).toBeVisible();
    expect(nodeItem('Welcome').queryByRole('button', { name: 'Rename Welcome' })).toBeNull();
  });

  it('addNodeFromPalette', async () => {
    const { user } = open('/chatbots/c1');
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    await user.click(await screen.findByRole('button', { name: /^Ask a question/ }));
    expect(nodes().items()).toHaveLength(4);
    expect(screen.getByRole('listitem', { name: 'AskAQuestion' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('leavingDirtyEditorAsks', async () => {
    const { user } = open('/chatbots/c1');
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    await user.click(await screen.findByRole('button', { name: /^Wait/ }));
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Back to chatbots' }));
    expect(await screen.findByText('Leave without saving?')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/chatbots/c1');
    await user.click(screen.getByRole('button', { name: 'Back to chatbots' }));
    await user.click(await screen.findByRole('button', { name: 'Leave' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/chatbots$/);
  });

  it('staleSaveShowsBanner', async () => {
    const { user } = open('/chatbots/c1', {
      [`PUT ${CHATBOTS_BASE}/c1`]: { status: 409, body: { code: 'CONFLICT', message: 'changed by another request' } },
    });
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    await user.click(await screen.findByRole('button', { name: /^Wait/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/saved by someone else/)).toBeVisible();
  });
});
