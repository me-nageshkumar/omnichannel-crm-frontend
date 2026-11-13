import type { Problem, SavedEdge, SavedFlow, SavedNode } from '@app/api/chatbots';
import { CATALOG } from '@app/Chatbots/nodeCatalog';

export type StepState = 'waiting' | 'done' | 'failed';

/** What a canvas node carries; `entry` marks the node nothing points to. */
export interface NodeData {
  name: string;
  type: SavedNode['type'];
  settings: Record<string, unknown>;
  problems: Problem[];
  entry: boolean;
  run?: StepState;
  /** React Flow wants node data indexable. */
  [extra: string]: unknown;
}

/** The React Flow node and edge shapes we use (a structural subset, so the model needs no canvas import). */
export interface CanvasNode {
  id: string;
  type: 'chatbot';
  position: { x: number; y: number };
  data: NodeData;
  [extra: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
  type: 'chatbot';
  [extra: string]: unknown;
}

export const NAME = /^[A-Za-z0-9_]{1,40}$/;
export const isValidName = (s: string): boolean => NAME.test(s);

export function entryNodeId(flow: SavedFlow): string | null {
  const targets: Record<string, true> = {};
  flow.edges.forEach((e) => (targets[e.target] = true));
  const roots = flow.nodes.filter((n) => !targets[n.id]);
  return roots.length === 1 ? roots[0].id : null;
}

export function toCanvas(flow: SavedFlow, problems: Problem[] = []): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const entry = entryNodeId(flow);
  const nodes: CanvasNode[] = flow.nodes.map((n) => ({
    id: n.id,
    type: 'chatbot',
    position: { ...n.position },
    data: {
      name: n.data.name,
      type: n.type,
      settings: n.data.settings,
      problems: problems.filter((p) => p.nodeId === n.id),
      entry: n.id === entry,
    },
  }));
  const edges: CanvasEdge[] = flow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    type: 'chatbot',
  }));
  return { nodes, edges };
}

export function fromCanvas(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  viewport: { x: number; y: number; zoom: number } | undefined,
): SavedFlow {
  const out: SavedFlow = {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      position: { x: n.position.x, y: n.position.y },
      data: { name: n.data.name, settings: n.data.settings },
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? null, target: e.target })),
  };
  if (viewport) out.viewport = viewport;
  return out;
}

const baseName = (type: SavedNode['type']) =>
  CATALOG[type].label
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join('');

export function uniqueName(type: SavedNode['type'], nodes: SavedNode[], base?: string): string {
  const stem = base ?? baseName(type);
  const taken: Record<string, true> = {};
  nodes.forEach((n) => (taken[n.data.name.toLowerCase()] = true));
  if (!taken[stem.toLowerCase()]) return stem;
  for (let i = 2; ; i++) {
    const candidate = `${stem}${i}`;
    if (!taken[candidate.toLowerCase()]) return candidate;
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function rewriteStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => rewriteStrings(v, fn));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.keys(value as Record<string, unknown>).forEach((k) => {
      out[k] = rewriteStrings((value as Record<string, unknown>)[k], fn);
    });
    return out;
  }
  return value;
}

/** Renames the node and rewrites `{{Old.` to `{{New.` in every string of every node's settings (spec §4.4). */
export function renameNode(flow: SavedFlow, nodeId: string, newName: string): SavedFlow {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return flow;
  const oldName = node.data.name;
  const re = new RegExp(`\\{\\{(\\s*)${escapeRe(oldName)}\\.`, 'g');
  const fn = (s: string) => s.replace(re, (_m, ws: string) => `{{${ws}${newName}.`);
  return {
    ...flow,
    nodes: flow.nodes.map((n) => ({
      ...n,
      data: {
        name: n.id === nodeId ? newName : n.data.name,
        settings: rewriteStrings(n.data.settings, fn) as Record<string, unknown>,
      },
    })),
  };
}

export function outputIds(node: SavedNode): string[] {
  return CATALOG[node.type].outputs(node.data.settings).map((o) => o.id);
}

/** Drops edges whose output no longer exists on their node, or whose end is gone. */
export function pruneEdges(flow: SavedFlow): SavedFlow {
  const byId: Record<string, SavedNode> = {};
  flow.nodes.forEach((n) => (byId[n.id] = n));
  return {
    ...flow,
    edges: flow.edges.filter((e) => {
      const source = byId[e.source];
      if (!source || !byId[e.target]) return false;
      return outputIds(source).indexOf(e.sourceHandle ?? 'next') >= 0;
    }),
  };
}

export function removeNode(flow: SavedFlow, nodeId: string): SavedFlow {
  return pruneEdges({ ...flow, nodes: flow.nodes.filter((n) => n.id !== nodeId) });
}

export function newNodeId(flow: SavedFlow): string {
  let i = flow.nodes.length + 1;
  const taken: Record<string, true> = {};
  flow.nodes.forEach((n) => (taken[n.id] = true));
  while (taken[`n${i}`]) i++;
  return `n${i}`;
}

export function addNode(flow: SavedFlow, type: SavedNode['type'], position: { x: number; y: number }): { flow: SavedFlow; id: string } {
  const id = newNodeId(flow);
  const node: SavedNode = {
    id,
    type,
    position,
    data: { name: uniqueName(type, flow.nodes), settings: CATALOG[type].defaultSettings() },
  };
  return { flow: { ...flow, nodes: flow.nodes.concat([node]) }, id };
}

/** A copy at +40/+40 with a unique name and no edges (spec §8.1). */
export function duplicateNode(flow: SavedFlow, nodeId: string): SavedFlow {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return flow;
  const copy: SavedNode = {
    id: newNodeId(flow),
    type: node.type,
    position: { x: node.position.x + 40, y: node.position.y + 40 },
    data: {
      name: uniqueName(node.type, flow.nodes, node.data.name.replace(/\d+$/, '')),
      settings: JSON.parse(JSON.stringify(node.data.settings)),
    },
  };
  return { ...flow, nodes: flow.nodes.concat([copy]) };
}

/** One edge per output, no self loops (spec §8.1). */
export function canConnect(flow: SavedFlow, source: string, sourceHandle: string | null, target: string): boolean {
  if (source === target) return false;
  const handle = sourceHandle ?? 'next';
  return !flow.edges.some((e) => e.source === source && (e.sourceHandle ?? 'next') === handle);
}

export function addEdge(flow: SavedFlow, source: string, sourceHandle: string | null, target: string): SavedFlow {
  if (!canConnect(flow, source, sourceHandle, target)) return flow;
  const handle = sourceHandle ?? 'next';
  const edge: SavedEdge = { id: `${source}-${handle}-${target}`, source, sourceHandle: handle, target };
  return { ...flow, edges: flow.edges.concat([edge]) };
}

/** The dirty check: nodes by id with position and data, edges by source/output/target; selection is not part of it. */
export function signature(flow: SavedFlow): string {
  const nodes = flow.nodes
    .map((n) => ({ id: n.id, type: n.type, x: n.position.x, y: n.position.y, data: n.data }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const edges = flow.edges
    .map((e) => ({ source: e.source, sourceHandle: e.sourceHandle ?? 'next', target: e.target }))
    .sort((a, b) => {
      const ka = `${a.source}>${a.sourceHandle}>${a.target}`;
      const kb = `${b.source}>${b.sourceHandle}>${b.target}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return JSON.stringify({ nodes, edges });
}

export function problemsByNode(problems: Problem[], flow: SavedFlow): { byNode: Record<string, Problem[]>; flow: Problem[]; stray: Problem[] } {
  const known: Record<string, true> = {};
  flow.nodes.forEach((n) => (known[n.id] = true));
  const byNode: Record<string, Problem[]> = {};
  const flowLevel: Problem[] = [];
  const stray: Problem[] = [];
  problems.forEach((p) => {
    if (p.nodeId === null) flowLevel.push(p);
    else if (known[p.nodeId]) (byNode[p.nodeId] = byNode[p.nodeId] || []).push(p);
    else stray.push(p);
  });
  return { byNode, flow: flowLevel, stray };
}

/** `nodes.<id>.<field>` and `flow.<field>` publish errors as problems. */
export function publishErrorsToProblems(fields: Record<string, string>): Problem[] {
  return Object.keys(fields).map((key) => {
    const m = /^nodes\.([^.]+)\.(.+)$/.exec(key);
    if (m) return { nodeId: m[1], nodeName: null, field: m[2], message: fields[key], severity: 'ERROR' as const };
    const f = /^flow\.(.+)$/.exec(key);
    return { nodeId: null, nodeName: null, field: f ? f[1] : key, message: fields[key], severity: 'ERROR' as const };
  });
}

export const countErrors = (problems: Problem[]): number => problems.filter((p) => p.severity === 'ERROR').length;

/** The checks the console can make before a save (the server's words where it has them). */
export function clientProblems(flow: SavedFlow, chatbotId?: string): Problem[] {
  const out: Problem[] = [];
  const seen: Record<string, true> = {};
  flow.nodes.forEach((n) => {
    const name = n.data.name;
    if (!isValidName(name)) {
      out.push({ nodeId: n.id, nodeName: name, field: 'name', message: 'must be 1 to 40 letters, digits or underscores', severity: 'ERROR' });
    } else if (seen[name.toLowerCase()]) {
      out.push({ nodeId: n.id, nodeName: name, field: 'name', message: 'another node has this name', severity: 'ERROR' });
    }
    seen[name.toLowerCase()] = true;
  });
  if (flow.nodes.length === 0) {
    out.push({ nodeId: null, nodeName: null, field: 'nodes', message: 'add at least one node', severity: 'ERROR' });
  } else {
    const targets: Record<string, true> = {};
    flow.edges.forEach((e) => (targets[e.target] = true));
    const roots = flow.nodes.filter((n) => !targets[n.id]);
    if (roots.length === 0) out.push({ nodeId: null, nodeName: null, field: 'entry', message: 'no entry node: every node has an edge pointing to it', severity: 'ERROR' });
    if (roots.length > 1) {
      out.push({
        nodeId: null,
        nodeName: null,
        field: 'entry',
        message: `two or more entry nodes: only one node may have nothing pointing to it (${roots.map((r) => r.data.name).join(', ')})`,
        severity: 'ERROR',
      });
    }
  }
  flow.nodes.forEach((n) => {
    if (n.type === 'send_message' && CATALOG.send_message.waitsFor(n.data.settings)) {
      const connected = flow.edges.some((e) => e.source === n.id && (e.sourceHandle ?? '').indexOf('reply:') === 0);
      if (!connected) {
        out.push({
          nodeId: n.id,
          nodeName: n.data.name,
          field: 'settings.message',
          message: 'no button is connected, so the chatbot would not wait for the reply',
          severity: 'WARNING',
        });
      }
    }
    if (n.type === 'jump' && chatbotId && n.data.settings.chatbotId === chatbotId) {
      out.push({ nodeId: n.id, nodeName: n.data.name, field: 'settings.chatbotId', message: 'a chatbot cannot jump to itself', severity: 'ERROR' });
    }
  });
  return out;
}
