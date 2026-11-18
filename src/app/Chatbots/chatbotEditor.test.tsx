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

  it('keepsMeasuredSizesWhenTheNodesAreRebuilt', async () => {
    // React Flow hides a card until it knows its size, and forgets the size whenever the node object is replaced
    // unless the size is handed back: the run arriving after mount, a selection or a poll all rebuild the nodes
    const { f } = open('/chatbots/c1?run=r1');
    expect(await screen.findByRole('dialog', { name: 'Run' })).toBeVisible();
    const polls = callsTo(f, `GET ${CHATBOTS_BASE}/c1/runs/r1`);
    fireEvent.click(screen.getByTestId('rf-measure'));
    // the next poll of the active run rebuilds the nodes
    await waitFor(() => expect(callsTo(f, `GET ${CHATBOTS_BASE}/c1/runs/r1`)).toBeGreaterThan(polls), {
      timeout: 4000,
    });
    await waitFor(() => {
      for (const li of nodes().items()) expect(li).toHaveAttribute('data-measured', '260x131');
    });
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

  it('a flow saved with an edge after the hand-over opens, and saving drops the edge', async () => {
    const handOver = {
      ...LEAD_QUALIFIER,
      flow: {
        nodes: [
          {
            id: 'h',
            type: 'assign_chat' as const,
            position: { x: 0, y: 0 },
            data: { name: 'Hand', settings: { mode: 'NUMBER_ROUTING' } },
          },
          {
            id: 's',
            type: 'send_message' as const,
            position: { x: 0, y: 200 },
            data: { name: 'After', settings: { message: { type: 'text', text: { body: 'x' } } } },
          },
        ],
        edges: [{ id: 'e1', source: 'h', sourceHandle: 'next', target: 's' }],
      },
    };
    const { f, user } = open('/chatbots/c1', {
      [`GET ${CHATBOTS_BASE}/c1`]: { status: 200, body: handOver },
      [`PUT ${CHATBOTS_BASE}/c1`]: { status: 200, body: { chatbot: { ...handOver, version: 4 }, problems: [] } },
    });
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    expect(nodeItem('Hand').getByText("By the number's routing")).toBeVisible();
    // the edge that can no longer run is gone on opening, so the draft can be saved without it at once
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(f, `PUT ${CHATBOTS_BASE}/c1`)).toBe(1));
    expect(requestTo(f, `PUT ${CHATBOTS_BASE}/c1`)?.body.flow.edges).toEqual([]);
  });

  it('a published chatbot with an old edge after the hand-over opens unchanged and read-only', async () => {
    const published = {
      ...LEAD_QUALIFIER,
      status: 'PUBLISHED' as const,
      flow: {
        nodes: [
          {
            id: 'h',
            type: 'assign_chat' as const,
            position: { x: 0, y: 0 },
            data: { name: 'Hand', settings: { mode: 'NUMBER_ROUTING' } },
          },
          {
            id: 's',
            type: 'send_message' as const,
            position: { x: 0, y: 200 },
            data: { name: 'After', settings: { message: { type: 'text', text: { body: 'x' } } } },
          },
        ],
        edges: [{ id: 'e1', source: 'h', sourceHandle: 'next', target: 's' }],
      },
    };
    const { user } = open('/chatbots/c1', { [`GET ${CHATBOTS_BASE}/c1`]: { status: 200, body: published } });
    expect(await screen.findByText(PUBLISHED_TEXT)).toBeVisible();
    // nothing to save, so leaving asks nothing
    await user.click(
      within(screen.getByRole('navigation', { name: 'Global', hidden: true })).getByRole('link', {
        name: 'All chatbots',
        hidden: true,
      }),
    );
    expect(screen.queryByText('Leave without saving?')).toBeNull();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/chatbots$/);
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

  const PROBLEM_SAVE = {
    [`PUT ${CHATBOTS_BASE}/c1`]: {
      status: 200,
      body: {
        chatbot: { ...LEAD_QUALIFIER, version: 4 },
        problems: [
          { nodeId: 'n2', nodeName: 'AskBudget', field: 'settings.text', message: 'is required', severity: 'WARNING' },
        ],
      },
    },
  };

  // review fix: the server's problems stay until the next save; editing another node does not clear them
  it('serverProblemsStayUntilNextSave', async () => {
    const { user } = open('/chatbots/c1', PROBLEM_SAVE);
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(nodeItem('AskBudget').getByRole('button', { name: 'Rename AskBudget' }));
    await user.type(await screen.findByRole('textbox', { name: 'Node name' }), '2{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: '1 problem' })).toBeVisible();
    await user.click(nodeItem('High').getByRole('button', { name: 'Rename High' }));
    await user.type(await screen.findByRole('textbox', { name: 'Node name' }), '2{Enter}');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '1 problem' })).toBeVisible();
    // the problem's own node changed: the server's word about it is stale and goes
    await user.click(nodeItem('AskBudget2').getByRole('button', { name: 'Rename AskBudget2' }));
    await user.type(await screen.findByRole('textbox', { name: 'Node name' }), '3{Enter}');
    expect(screen.queryByRole('button', { name: '1 problem' })).toBeNull();
  });

  // review fix: a draft can be renamed from the header; the name travels with the save
  it('renameChatbotSavesName', async () => {
    const { f, user } = open('/chatbots/c1', {
      [`PUT ${CHATBOTS_BASE}/c1`]: {
        status: 200,
        body: { chatbot: { ...LEAD_QUALIFIER, name: 'Lead bot', version: 4 }, problems: [] },
      },
    });
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(screen.getByRole('button', { name: 'Rename chatbot' }));
    const input = await screen.findByRole('textbox', { name: 'Chatbot name' });
    await user.clear(input);
    await user.type(input, 'Lead bot{Enter}');
    expect(screen.getByRole('heading', { name: 'Lead bot' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(f, `PUT ${CHATBOTS_BASE}/c1`)).toBe(1));
    expect(requestTo(f, `PUT ${CHATBOTS_BASE}/c1`)?.body.name).toBe('Lead bot');
  });

  // review fix (Review Focus 4): the sidebar asks too, not only the editor's own buttons
  it('sidebarLinkAsksWhenDirty', async () => {
    const { user } = open('/chatbots/c1');
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    await user.click(await screen.findByRole('button', { name: /^Wait/ }));
    // the sidebar is collapsed in jsdom: its links are in the DOM but hidden
    await user.click(
      within(screen.getByRole('navigation', { name: 'Global', hidden: true })).getByRole('link', {
        name: 'All chatbots',
        hidden: true,
      }),
    );
    expect(await screen.findByText('Leave without saving?')).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/chatbots/c1');
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/chatbots$/);
  });

  // review fix: a palette entry dragged onto the canvas lands there
  it('paletteDropAddsNodeAtPoint', async () => {
    open('/chatbots/c1');
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    const dataTransfer = {
      getData: (t: string) => (t === 'application/x-chatbot-node' ? 'wait' : ''),
      types: ['application/x-chatbot-node'],
      dropEffect: 'move',
    };
    fireEvent.dragOver(screen.getByTestId('react-flow'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('react-flow'), { dataTransfer, clientX: 300, clientY: 200 });
    expect(await screen.findByRole('listitem', { name: /^Wait/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  // review fix: Backspace inside the header or a side panel must not delete the selected node
  it('panelsAreNoKeyZones', async () => {
    const { user } = open('/chatbots/c1');
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    await user.click(nodeItem('AskBudget').getByText('AskBudget'));
    expect(await screen.findByRole('dialog', { name: 'AskBudget' })).toHaveClass('nokey');
    expect(document.querySelector('.omni-flow-header')).toHaveClass('nokey');
  });

  // seen in the manual check: after a connection drop opened the palette, picking a node left the palette open
  it('dropOnPaneThenPickClosesPaletteAndConnects', async () => {
    const { user } = open('/chatbots/c1');
    await screen.findByRole('heading', { name: 'Lead qualifier' });
    fireEvent.click(screen.getByTestId('rf-drop-on-pane'));
    await user.click(await screen.findByRole('button', { name: /^Wait/ }));
    expect(screen.queryByRole('list', { name: 'Node types' })).toBeNull();
    expect(screen.getByRole('listitem', { name: /^Wait/ })).toBeVisible();
    const edges = within(screen.getByRole('list', { name: 'Edges' })).getAllByRole('listitem');
    expect(edges.some((e) => /^n3 next /.test(e.textContent ?? ''))).toBe(true);
  });
});
