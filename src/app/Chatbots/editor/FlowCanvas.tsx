import * as React from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge, EdgeChange, EdgeTypes, Node, NodeChange, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Problem, SavedFlow } from '@app/api/chatbots';
import type { CanvasEdge, CanvasNode, NodeData, StepState } from '@app/Chatbots/flowModel';
import { canConnect, addEdge as connect, fromCanvas, toCanvas } from '@app/Chatbots/flowModel';
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
  onFlowChange(next: SavedFlow): void;
  onSelect(id: string | null): void;
  /** A connection dropped on empty canvas: add a node there, connected from the handle. */
  onAddAt?(position: { x: number; y: number }, connectFrom: { source: string; sourceHandle: string | null } | null): void;
}

const Inner: React.FunctionComponent<FlowCanvasProps> = ({ flow, readOnly, problems, runByNode, selectedId, onFlowChange, onSelect, onAddAt }) => {
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
    () => canvas.edges.map((e) => ({ ...(e as unknown as Edge), data: { readOnly, onRemove: (id: string) => onFlowChange({ ...flow, edges: flow.edges.filter((x) => x.id !== id) }) } })),
    [canvas.edges, readOnly, flow, onFlowChange],
  );

  const onNodesChange = (changes: NodeChange<Node<NodeData>>[]) => {
    const next = applyNodeChanges(changes as NodeChange<Node>[], nodes as Node[]);
    const moved = changes.some((c) => c.type === 'position' || c.type === 'remove');
    if (moved && !readOnly) onFlowChange(fromCanvas(next as unknown as CanvasNode[], canvas.edges, flow.viewport));
  };
  const onEdgesChange = (changes: EdgeChange<Edge>[]) => {
    if (readOnly) return;
    if (changes.some((c) => c.type === 'remove')) {
      const next = applyEdgeChanges(changes, edges);
      onFlowChange(fromCanvas(canvas.nodes, next as unknown as CanvasEdge[], flow.viewport));
    }
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
      isValidConnection={(c) => !!c.source && !!c.target && canConnect(flow, c.source, c.sourceHandle ?? null, c.target)}
      onConnectEnd={(event, state) => {
        if (readOnly || !onAddAt || state.isValid || !state.fromNode) return;
        const point = 'clientX' in event ? { x: event.clientX, y: event.clientY } : { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        onAddAt(rf.screenToFlowPosition(point), { source: state.fromNode.id, sourceHandle: state.fromHandle?.id ?? null });
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
