import { describe, expect, it } from 'vitest';
import type { Problem, SavedFlow, SavedNode } from '@app/api/chatbots';
import {
  addNodeConnected,
  applyEdgeChangesToFlow,
  applyNodeChangesToFlow,
  canConnect,
  clientProblems,
  duplicateNode,
  entryNodeId,
  fromCanvas,
  isValidName,
  problemsByNode,
  pruneEdges,
  publishErrorsToProblems,
  removeNode,
  renameNode,
  signature,
  toCanvas,
  uniqueName,
} from '@app/Chatbots/flowModel';
import { LEAD_QUALIFIER } from '../../test/chatbots';

const flow = (): SavedFlow => JSON.parse(JSON.stringify(LEAD_QUALIFIER.flow));

describe('flowModel', () => {
  it('roundTripKeepsPositions', () => {
    const { nodes, edges } = toCanvas(flow());
    expect(nodes).toHaveLength(3);
    expect(nodes[0].position).toEqual({ x: 100, y: 100 });
    expect(nodes[0].data.name).toBe('Welcome');
    expect(nodes[0].data.entry).toBe(true);
    expect(nodes[1].data.entry).toBe(false);
    expect(edges[0].sourceHandle).toBe('reply:yes');
    const back = fromCanvas(nodes, edges, { x: 0, y: 0, zoom: 1 });
    expect(back).toEqual(flow());
  });

  it('fromCanvasDropsMeasuredAndSelected', () => {
    const { nodes, edges } = toCanvas(flow());
    const decorated = nodes.map((n) => ({
      ...n,
      measured: { width: 300, height: 100 },
      selected: true,
      dragging: false,
    }));
    const back = fromCanvas(decorated, edges, undefined);
    expect(Object.keys(back.nodes[0])).toEqual(['id', 'type', 'position', 'data']);
    expect(back.viewport).toBeUndefined();
  });

  it('uniqueNameCounts', () => {
    const f = flow();
    expect(uniqueName('send_message', f.nodes)).toBe('SendMessage');
    f.nodes.push({ ...f.nodes[0], id: 'x', data: { ...f.nodes[0].data, name: 'SendMessage' } });
    expect(uniqueName('send_message', f.nodes)).toBe('SendMessage2');
    expect(isValidName('AskBudget')).toBe(true);
    expect(isValidName('Ask budget')).toBe(false);
    expect(isValidName('')).toBe(false);
    expect(isValidName('a'.repeat(41))).toBe(false);
  });

  it('renameRewritesReferences', () => {
    const renamed = renameNode(flow(), 'n2', 'Budget');
    expect(renamed.nodes[1].data.name).toBe('Budget');
    const high = renamed.nodes[2].data.settings as { message: { text: { body: string } } };
    expect(high.message.text.body).toBe('Great, {{Budget.answer}} it is');
    const f = flow();
    (f.nodes[2].data.settings as { message: { text: { body: string } } }).message.text.body =
      '{{AskBudgetX.answer}} {{AskBudget.answer}}';
    const r2 = renameNode(f, 'n2', 'B');
    expect((r2.nodes[2].data.settings as { message: { text: { body: string } } }).message.text.body).toBe(
      '{{AskBudgetX.answer}} {{B.answer}}',
    );
  });

  it('removedOutputDropsItsEdge', () => {
    const f = flow();
    const welcome = f.nodes[0].data.settings as { message: { interactive: { action: { buttons: unknown[] } } } };
    welcome.message.interactive.action.buttons = [{ type: 'reply', reply: { id: 'no', title: 'No' } }];
    const pruned = pruneEdges(f);
    expect(pruned.edges.map((e) => e.id)).toEqual(['e2']);
    const gone = removeNode(flow(), 'n2');
    expect(gone.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(gone.edges).toEqual([]);
  });

  it('entryNodeIdIsTheOnlyRoot', () => {
    expect(entryNodeId(flow())).toBe('n1');
    const cycle: SavedFlow = {
      nodes: [
        {
          id: 'a',
          type: 'wait',
          position: { x: 0, y: 0 },
          data: { name: 'A', settings: { amount: 1, unit: 'HOURS' } },
        },
        {
          id: 'b',
          type: 'wait',
          position: { x: 0, y: 0 },
          data: { name: 'B', settings: { amount: 1, unit: 'HOURS' } },
        },
      ],
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 'next', target: 'b' },
        { id: 'e2', source: 'b', sourceHandle: 'next', target: 'a' },
      ],
    };
    expect(entryNodeId(cycle)).toBeNull();
    expect(entryNodeId({ nodes: [], edges: [] })).toBeNull();
  });

  it('canConnectRefusesSecondEdgeAndSelfLoop', () => {
    const f = flow();
    expect(canConnect(f, 'n1', 'reply:yes', 'n3')).toBe(false);
    expect(canConnect(f, 'n1', 'reply:no', 'n3')).toBe(true);
    expect(canConnect(f, 'n1', 'reply:no', 'n1')).toBe(false);
  });

  it('signatureIgnoresSelectionAndEdgeOrder', () => {
    const f = flow();
    const { nodes, edges } = toCanvas(f);
    const a = signature(
      fromCanvas(
        nodes.map((n) => ({ ...n, selected: true })),
        edges,
        undefined,
      ),
    );
    expect(a).toBe(signature(f));
    const g = flow();
    g.edges.reverse();
    expect(signature(g)).toBe(signature(f));
    g.nodes[0].position = { x: 999, y: 1 };
    expect(signature(g)).not.toBe(signature(f));
  });

  it('duplicateNodeOffsetsAndRenames', () => {
    const d = duplicateNode(flow(), 'n2');
    expect(d.nodes).toHaveLength(4);
    const copy = d.nodes[3];
    expect(copy.id).not.toBe('n2');
    expect(copy.position).toEqual({ x: 540, y: 140 });
    expect(copy.data.name).toBe('AskBudget2');
    expect(copy.data.settings).toEqual(d.nodes[1].data.settings);
    expect(d.edges).toHaveLength(2);
  });

  it('problemsByNodeBucketsAndStrayProblemsGoToBanner', () => {
    const problems: Problem[] = [
      { nodeId: 'n2', nodeName: 'AskBudget', field: 'settings.text', message: 'is required', severity: 'ERROR' },
      { nodeId: null, nodeName: null, field: 'entry', message: 'no entry node', severity: 'ERROR' },
      { nodeId: 'gone', nodeName: 'Gone', field: 'settings.x', message: 'meh', severity: 'WARNING' },
    ];
    const b = problemsByNode(problems, flow());
    expect(b.byNode.n2).toHaveLength(1);
    expect(b.flow).toHaveLength(1);
    expect(b.stray).toHaveLength(1);
    expect(b.stray[0].nodeName).toBe('Gone');
  });

  it('publishErrorsParseKeys', () => {
    const p = publishErrorsToProblems({
      'nodes.n2.settings.text': 'is required',
      'flow.entry': 'two or more entry nodes',
    });
    expect(p).toEqual([
      { nodeId: 'n2', nodeName: null, field: 'settings.text', message: 'is required', severity: 'ERROR' },
      { nodeId: null, nodeName: null, field: 'entry', message: 'two or more entry nodes', severity: 'ERROR' },
    ]);
  });

  it('clientProblemsEntryNamesAndUnconnectedButtons', () => {
    const f = flow();
    f.nodes[1].data.name = 'Ask budget';
    f.nodes[2].data.name = 'welcome';
    f.edges = [];
    const p = clientProblems(f);
    expect(p.filter((x) => x.field === 'name').map((x) => x.nodeId)).toEqual(['n2', 'n3']);
    expect(p.some((x) => x.nodeId === null && x.field === 'entry')).toBe(true);
    expect(p.some((x) => x.nodeId === 'n1' && x.severity === 'WARNING' && x.field === 'settings.message')).toBe(true);
    expect(clientProblems(flow())).toEqual([]);
    const self: SavedNode = {
      id: 'j',
      type: 'jump',
      position: { x: 0, y: 0 },
      data: { name: 'J', settings: { chatbotId: 'c1' } },
    };
    expect(clientProblems({ nodes: [self], edges: [] }, 'c1').some((x) => x.field === 'settings.chatbotId')).toBe(true);
  });

  // review fix: the canvas applies React Flow's change sets to the saved flow itself, so a keyboard Delete of a node
  // takes its edges along even though React Flow reports the edge and node removals in two separate callbacks
  it('applyNodeChangesRemovesNodeAndItsEdges', () => {
    const f = flow();
    const next = applyNodeChangesToFlow(f, [{ type: 'remove', id: 'n2' }]);
    expect(next.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(next.edges).toEqual([]);
    const moved = applyNodeChangesToFlow(f, [{ type: 'position', id: 'n1', position: { x: 5, y: 6 } }]);
    expect(moved.nodes[0].position).toEqual({ x: 5, y: 6 });
    expect(applyNodeChangesToFlow(f, [{ type: 'select', id: 'n1', selected: true }])).toBe(f);
  });

  it('applyEdgeChangesRemovesEdge', () => {
    const f = flow();
    expect(applyEdgeChangesToFlow(f, [{ type: 'remove', id: 'e1' }]).edges.map((e) => e.id)).toEqual(['e2']);
    expect(applyEdgeChangesToFlow(f, [{ type: 'select', id: 'e1', selected: true }])).toBe(f);
  });

  // review fix: a connection dropped on empty canvas respects one edge per output like any other connection
  it('addNodeConnectedRefusesSecondEdge', () => {
    const f = flow();
    const taken = addNodeConnected(f, 'wait', { x: 0, y: 0 }, { source: 'n2', sourceHandle: 'next' });
    expect(taken.flow.nodes).toHaveLength(4);
    expect(taken.flow.edges).toHaveLength(2);
    const free = addNodeConnected(f, 'wait', { x: 0, y: 0 }, { source: 'n3', sourceHandle: null });
    expect(free.flow.edges).toHaveLength(3);
    expect(free.flow.edges[2]).toEqual({
      id: `n3-next-${free.id}`,
      source: 'n3',
      sourceHandle: 'next',
      target: free.id,
    });
  });
});
