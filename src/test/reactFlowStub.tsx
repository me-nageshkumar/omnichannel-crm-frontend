import * as React from 'react';
import { vi } from 'vitest';

/**
 * A stand-in for @xyflow/react in jsdom (no layout, no SVG measuring): renders every node through its registered
 * node type inside a listitem, so the editor's forms, saving and problem routing can be tested. Import it before the
 * page under test.
 */
vi.mock('@xyflow/react', () => {
  type AnyNode = {
    id: string;
    type?: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
    selected?: boolean;
  };
  type AnyEdge = { id: string; source: string; target: string; sourceHandle?: string | null };
  const ReactFlow: React.FunctionComponent<{
    nodes: AnyNode[];
    edges: AnyEdge[];
    nodeTypes?: Record<string, React.ComponentType<{ id: string; data: Record<string, unknown>; selected?: boolean }>>;
    onNodeClick?(e: React.MouseEvent, node: AnyNode): void;
    onDrop?(e: React.DragEvent): void;
    onDragOver?(e: React.DragEvent): void;
    children?: React.ReactNode;
  }> = ({ nodes, edges, nodeTypes, onNodeClick, onDrop, onDragOver, children }) => (
    <div data-testid="react-flow" onDrop={onDrop} onDragOver={onDragOver}>
      <ul aria-label="Nodes">
        {nodes.map((n) => {
          const Type = nodeTypes?.[n.type ?? 'default'];
          return (
            <li
              key={n.id}
              role="listitem"
              aria-label={String(n.data.name ?? n.id)}
              onClick={(e) => onNodeClick?.(e, n)}
            >
              {Type ? <Type id={n.id} data={n.data} selected={n.selected} /> : String(n.data.name)}
            </li>
          );
        })}
      </ul>
      <ul aria-label="Edges">
        {edges.map((e) => (
          <li key={e.id}>{`${e.source} ${e.sourceHandle ?? 'next'} ${e.target}`}</li>
        ))}
      </ul>
      {children}
    </div>
  );
  const passthrough: React.FunctionComponent<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
  const nothing: React.FunctionComponent<Record<string, unknown>> = () => null;
  return {
    ReactFlow,
    ReactFlowProvider: passthrough,
    Panel: passthrough,
    Handle: ({ id, type }: { id?: string; type: string }) => <span data-handle={type} data-id={id ?? 'next'} />,
    Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
    MiniMap: nothing,
    Controls: nothing,
    Background: nothing,
    BackgroundVariant: { Dots: 'dots', Lines: 'lines', Cross: 'cross' },
    BaseEdge: nothing,
    EdgeLabelRenderer: passthrough,
    getBezierPath: () => ['M0 0', 0, 0],
    applyNodeChanges: (changes: unknown[], nodes: AnyNode[]) => nodes,
    applyEdgeChanges: (changes: unknown[], edges: AnyEdge[]) => edges,
    addEdge: (c: AnyEdge, edges: AnyEdge[]) => edges.concat([c]),
    useReactFlow: () => ({
      fitView: () => undefined,
      setCenter: () => undefined,
      screenToFlowPosition: (p: { x: number; y: number }) => p,
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    }),
    useNodeConnections: () => [],
    useUpdateNodeInternals: () => () => undefined,
  };
});
