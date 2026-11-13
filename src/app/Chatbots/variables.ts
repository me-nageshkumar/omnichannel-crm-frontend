import type { ChatbotOptions, SavedFlow } from '@app/api/chatbots';
import type { EventKind } from '@app/api/automations';
import { FIELDS } from '@app/Automations/automationModel';
import { CATALOG } from '@app/Chatbots/nodeCatalog';

export interface VariablePath {
  path: string;
  hint?: string;
}

export interface VariableGroup {
  label: string;
  paths: VariablePath[];
}

/** The variables a node may use (spec §4.4): fixed roots, the event's fields, then every other node's outputs. */
export function variableSchema(
  flow: SavedFlow,
  upstreamOf: string | null,
  options: ChatbotOptions | null,
  event: EventKind | 'any',
): VariableGroup[] {
  const contact: VariablePath[] = [
    { path: 'contact.name', hint: "The contact's name" },
    { path: 'contact.phone', hint: 'Digits, no plus' },
  ];
  (options?.attributes ?? []).forEach((a) => contact.push({ path: `contact.attributes.${a.key}`, hint: a.name }));
  contact.push({ path: 'contact.labels', hint: 'Label names' });
  contact.push({ path: 'contact.doNotContact', hint: 'true or false' });
  const chat: VariablePath[] = [
    { path: 'chat.id' },
    { path: 'chat.status', hint: 'OPEN or CLOSED' },
    { path: 'chat.assignedUser' },
    { path: 'chat.assignedTeam' },
    { path: 'number.label' },
    { path: 'number.phone' },
  ];
  const kinds: EventKind[] = event === 'any' ? ['MESSAGE_RECEIVED', 'DEAL_LANE_CHANGED'] : [event];
  const eventPaths: VariablePath[] = [];
  const seen: Record<string, true> = {};
  kinds.forEach((k) =>
    FIELDS[k].forEach((f) => {
      const path = `event.${f.field}`;
      if (!seen[path]) {
        seen[path] = true;
        eventPaths.push({ path, hint: f.label });
      }
    }),
  );
  if (kinds.indexOf('DEAL_LANE_CHANGED') >= 0) {
    [
      'event.deal.title',
      'event.deal.amount',
      'event.toLane.name',
      'event.fromLane.name',
      'event.pipeline.name',
    ].forEach((p) => {
      if (!seen[p]) {
        seen[p] = true;
        eventPaths.push({ path: p });
      }
    });
  }
  if (kinds.indexOf('MESSAGE_RECEIVED') >= 0) {
    ['event.message.text', 'event.message.type', 'event.chat.new', 'event.number.label'].forEach((p) => {
      if (!seen[p]) {
        seen[p] = true;
        eventPaths.push({ path: p });
      }
    });
  }
  const trigger: VariablePath[] = [
    { path: 'trigger.ruleName', hint: 'The rule that started the run, or Test' },
    { path: 'trigger.ruleId' },
    { path: 'trigger.eventId' },
    { path: 'trigger.at', hint: 'When the run started (ISO)' },
  ];
  const groups: VariableGroup[] = [
    { label: 'Contact', paths: contact },
    { label: 'Chat', paths: chat },
    { label: 'Event', paths: eventPaths },
    { label: 'Trigger', paths: trigger },
    { label: 'Now', paths: [{ path: 'now', hint: 'The current time (ISO)' }] },
  ];
  const upstream = upstreamOf ? ancestors(flow, upstreamOf) : {};
  const others = flow.nodes.filter((n) => n.id !== upstreamOf && CATALOG[n.type].produces(n.data.settings).length > 0);
  others.sort((a, b) => {
    const ua = upstream[a.id] ? 0 : 1;
    const ub = upstream[b.id] ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return a.data.name < b.data.name ? -1 : a.data.name > b.data.name ? 1 : 0;
  });
  others.forEach((n) => {
    groups.push({
      label: n.data.name,
      paths: CATALOG[n.type].produces(n.data.settings).map((f) => ({ path: `${n.data.name}.${f}` })),
    });
  });
  return groups;
}

/** The nodes that can reach `nodeId`, keyed by id. */
function ancestors(flow: SavedFlow, nodeId: string): Record<string, true> {
  const incoming: Record<string, string[]> = {};
  flow.edges.forEach((e) => (incoming[e.target] = incoming[e.target] || []).push(e.source));
  const seen: Record<string, true> = {};
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.shift() as string;
    (incoming[id] || []).forEach((s) => {
      if (!seen[s]) {
        seen[s] = true;
        queue.push(s);
      }
    });
  }
  return seen;
}

/** When the caret sits after an unclosed `{{`: the typed query and where the `{{` starts. */
export function completeAt(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf('{{');
  if (open < 0) return null;
  const since = before.slice(open + 2);
  if (since.indexOf('}}') >= 0 || /\s/.test(since)) return null;
  return { query: since, start: open };
}

/** Replaces `[start, end)` with `{{path}}`; the caret lands after the closing braces. */
export function insertAt(text: string, start: number, end: number, path: string): { text: string; caret: number } {
  const token = `{{${path}}}`;
  const next = text.slice(0, start) + token + text.slice(end);
  return { text: next, caret: start + token.length };
}
