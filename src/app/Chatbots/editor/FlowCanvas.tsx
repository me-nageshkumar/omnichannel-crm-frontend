import * as React from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge, EdgeChange, EdgeTypes, Node, NodeChange, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Problem, SavedFlow } from '@app/api/chatbots';
import type { NodeType } from '@app/api/chatbots';
import type { NodeData, StepState } from '@app/Chatbots/flowModel';
import {
  applyEdgeChangesToFlow,
  applyNodeChangesToFlow,
  canConnect,
  addEdge as connect,
  toCanvas,
} from '@app/Chatbots/flowModel';
import { FlowEdge } from '@app/Chatbots/editor/FlowEdge';
import { FlowNodeCard } from '@app/Chatbots/editor/FlowNodeCard';

// our card and edge take the subset of React Flow's props they use
const nodeTypes = { chatbot: FlowNodeCard } as unknown as NodeTypes;
const edgeTypes = { chatbot: FlowEdge } as unknown as EdgeTypes;

export interface FlowCanvasProps {
  flow: SavedFlow;
  readOnly: boolean;
  problems: Problem[];
  runByNode?: Record<string, StepState>;
  selectedId: string | null;
  /** Takes the next flow or an updater, so two change sets in one tick (React Flow's Delete) both land. */
  onFlowChange(next: SavedFlow | ((current: SavedFlow) => SavedFlow)): void;
  onSelect(id: string | null): void;
  /** A connection dropped on empty canvas: add a node there, connected from the handle. */
  onAddAt?(
    position: { x: number; y: number },
    connectFrom: { source: string; sourceHandle: string | null } | null,
  ): void;
  /** A palette entry dropped on the canvas: add a node of that type there. */
  onDropType?(type: NodeType, position: { x: number; y: number }): void;
}

export const DRAG_TYPE = 'application/x-chatbot-node';

const Inner: React.FunctionComponent<FlowCanvasProps> = ({
  flow,
  readOnly,
  problems,
  runByNode,
  selectedId,
  onFlowChange,
  onSelect,
  onAddAt,
  onDropType,
}) => {
  const rf = useReactFlow();
  const canvas = React.useMemo(() => toCanvas(flow, problems), [flow, problems]);
  const nodes: Node<NodeData>[] = React.useMemo(
    () =>
      canvas.nodes.map((n) => ({
        ...(n as unknown as Node<NodeData>),
        selected: n.id === selectedId,
        data: { ...n.data, run: runByNode?.[n.id] },
      })),
    [canvas.nodes, selectedId, runByNode],
  );
  const edges: Edge[] = React.useMemo(
    () =>
      canvas.edges.map((e) => ({
        ...(e as unknown as Edge),
        data: {
          readOnly,
          onRemove: (id: string) => onFlowChange({ ...flow, edges: flow.edges.filter((x) => x.id !== id) }),
        },
      })),
    [canvas.edges, readOnly, flow, onFlowChange],
  );

  // React Flow reports a Delete as edge removals and then node removals in the same tick: both go through updaters
  // on the saved flow, so neither overwrites the other.
  const onNodesChange = (changes: NodeChange<Node<NodeData>>[]) => {
    if (readOnly) return;
    const settled = changes.filter((c) => c.type === 'remove' || (c.type === 'position' && !c.dragging && c.position));
    if (settled.length > 0)
      onFlowChange((current) =>
        applyNodeChangesToFlow(current, settled as unknown as Parameters<typeof applyNodeChangesToFlow>[1]),
      );
  };
  const onEdgesChange = (changes: EdgeChange<Edge>[]) => {
    if (readOnly) return;
    if (changes.some((c) => c.type === 'remove')) onFlowChange((current) => applyEdgeChangesToFlow(current, changes));
  };
  const onConnect = (c: Connection) => {
    if (readOnly || !c.source || !c.target) return;
    onFlowChange(connect(flow, c.source, c.sourceHandle ?? null, c.target));
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={(c) =>
        !!c.source && !!c.target && canConnect(flow, c.source, c.sourceHandle ?? null, c.target)
      }
      onConnectEnd={(event, state) => {
        // only a drop on empty canvas adds a node; a drop on a node that refused the connection adds nothing
        if (readOnly || !onAddAt || state.isValid || !state.fromNode || state.toNode) return;
        const point =
          'clientX' in event
            ? { x: event.clientX, y: event.clientY }
            : { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        onAddAt(rf.screenToFlowPosition(point), {
          source: state.fromNode.id,
          sourceHandle: state.fromHandle?.id ?? null,
        });
      }}
      onDragOver={(e) => {
        if (readOnly || !onDropType) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        if (readOnly || !onDropType) return;
        const type = e.dataTransfer.getData(DRAG_TYPE) as NodeType;
        if (!type) return;
        e.preventDefault();
        onDropType(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      }}
      onNodeClick={(_e, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      onMoveEnd={(_e, viewport) => onFlowChange({ ...flow, viewport })}
      nodesConnectable={!readOnly}
      deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
      snapToGrid
      snapGrid={[20, 20]}
      minZoom={0.2}
      fitView
      defaultViewport={flow.viewport}
      proOptions={{ hideAttribution: true }}
    >
      <MiniMap pannable zoomable />
      <Controls showInteractive={false} />
      <Background variant={BackgroundVariant.Dots} gap={20} />
    </ReactFlow>
  );
};

/** The React Flow canvas of a chatbot (spec §8.1). */
export const FlowCanvas: React.FunctionComponent<FlowCanvasProps> = (props) => (
  <div className="omni-flow">
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  </div>
);
