import * as React from 'react';
import {
  ArrowRightIcon,
  BanIcon,
  BuildingIcon,
  ClockIcon,
  CodeBranchIcon,
  FileAltIcon,
  GlobeIcon,
  ListIcon,
  PaperPlaneIcon,
  QuestionCircleIcon,
  UserEditIcon,
  UsersIcon,
} from '@patternfly/react-icons';
import type { ChatbotOptions, NodeType, TaskKind } from '@app/api/chatbots';

export interface NodeOutput {
  id: string;
  label: string;
}

/** What the canvas and the drawer know about a node type (spec §4.2); outputs match the server's exactly. */
export interface NodeMeta {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ComponentType;
  defaultSettings(): Record<string, unknown>;
  outputs(settings: Record<string, unknown>): NodeOutput[];
  preview(settings: Record<string, unknown>, options: ChatbotOptions | null): string;
  waitsFor(settings: Record<string, unknown>): TaskKind | null;
  /** The output variable fields the node writes under its name, e.g. ['answer']. */
  produces(settings: Record<string, unknown>): string[];
}

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const NEXT: NodeOutput = { id: 'next', label: 'Next' };

/** The reply buttons or list rows of a Cloud message object, as `{id, title}`; empty for anything else. */
export function repliesOf(message: unknown): { id: string; title: string }[] {
  const m = message as Any;
  const i = m?.interactive as Any;
  if (!i) return [];
  if (i.type === 'button') {
    return ((i.action?.buttons as Any[]) ?? [])
      .map((b) => b?.reply)
      .filter((r) => r && r.id)
      .map((r) => ({ id: String(r.id), title: String(r.title ?? r.id) }));
  }
  if (i.type === 'list') {
    const out: { id: string; title: string }[] = [];
    ((i.action?.sections as Any[]) ?? []).forEach((s) =>
      ((s?.rows as Any[]) ?? []).forEach((r) => {
        if (r && r.id) out.push({ id: String(r.id), title: String(r.title ?? r.id) });
      }),
    );
    return out;
  }
  return [];
}

const cut = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const bodyOf = (message: unknown): string => {
  const m = message as Any;
  if (!m) return '';
  if (m.text?.body) return String(m.text.body);
  if (m.interactive?.body?.text) return String(m.interactive.body.text);
  const media = m.image ?? m.video ?? m.audio ?? m.document;
  if (media) return media.caption ? String(media.caption) : `${m.type} file`;
  if (m.location) return `Location: ${m.location.name ?? `${m.location.latitude}, ${m.location.longitude}`}`;
  return '';
};

const nameOf = (list: { id: string; name: string }[] | undefined, id: unknown, fallback = '…') =>
  (list ?? []).find((x) => x.id === id)?.name ?? (id ? String(id) : fallback);

export const CATALOG: Record<NodeType, NodeMeta> = {
  send_message: {
    type: 'send_message',
    label: 'Send message',
    description: 'A text, media, location or interactive WhatsApp message. Buttons and lists wait for the reply.',
    icon: PaperPlaneIcon,
    defaultSettings: () => ({ message: { type: 'text', text: { preview_url: false, body: '' } } }),
    outputs: (s) => {
      const replies = repliesOf(s.message);
      if (replies.length === 0) return [NEXT];
      return replies
        .map((r) => ({ id: `reply:${r.id}`, label: r.title }))
        .concat([{ id: 'other', label: 'Other reply' }]);
    },
    preview: (s) => cut(bodyOf(s.message)) || 'Empty message',
    waitsFor: (s) => (repliesOf(s.message).length > 0 ? 'WHATSAPP_REPLY' : null),
    produces: (s) => (repliesOf(s.message).length > 0 ? ['reply.id', 'reply.title', 'reply.text'] : []),
  },
  send_template: {
    type: 'send_template',
    label: 'Send template',
    description: "One of the brand's saved templates, its placeholders filled.",
    icon: FileAltIcon,
    defaultSettings: () => ({ templateId: null, values: {} }),
    outputs: () => [NEXT],
    preview: (s, o) => `Template: ${nameOf(o?.templates, s.templateId, 'pick one')}`,
    waitsFor: () => null,
    produces: () => [],
  },
  ask_question: {
    type: 'ask_question',
    label: 'Ask a question',
    description: 'Asks and waits for an answer of a type: text, number, email, phone, date, location or a file.',
    icon: QuestionCircleIcon,
    defaultSettings: () => ({
      text: '',
      answerType: 'TEXT',
      saveAs: '',
      attributeId: null,
      retries: 2,
      retryMessage: '',
      giveUpMessage: '',
    }),
    outputs: () => [NEXT, { id: 'noAnswer', label: 'No valid answer' }],
    preview: (s) => `${cut(String(s.text ?? '')) || 'Empty question'}\n${String(s.answerType ?? 'TEXT').toLowerCase()}`,
    waitsFor: () => 'WHATSAPP_REPLY',
    produces: () => ['answer'],
  },
  ask_form: {
    type: 'ask_form',
    label: 'Ask with a form',
    description: 'Sends a link to a form the person fills in; waits for the submission.',
    icon: ListIcon,
    defaultSettings: () => ({
      title: '',
      intro: '',
      fields: [],
      submitText: 'Send',
      thanksText: 'Thank you!',
      linkMessage: 'Please fill in this short form: {{form.url}}',
    }),
    outputs: () => [NEXT],
    preview: (s) => `${cut(String(s.title ?? '')) || 'Untitled form'}\n${((s.fields as Any[]) ?? []).length} field(s)`,
    waitsFor: () => 'FORM',
    produces: (s) =>
      ((s.fields as Any[]) ?? [])
        .filter((f) => f?.key)
        .map((f) => `form.${f.key}`)
        .concat(['form.submittedAt']),
  },
  condition: {
    type: 'condition',
    label: 'Condition',
    description: 'Branches on the variables: the first case that matches wins, else Otherwise.',
    icon: CodeBranchIcon,
    defaultSettings: () => ({ cases: [] }),
    outputs: (s) =>
      ((s.cases as Any[]) ?? [])
        .filter((c) => c?.id)
        .map((c) => ({ id: `case:${c.id}`, label: String(c.label || c.id) }))
        .concat([{ id: 'otherwise', label: 'Otherwise' }]),
    preview: (s) => `${((s.cases as Any[]) ?? []).length} case(s)`,
    waitsFor: () => null,
    produces: () => ['matched'],
  },
  update_contact: {
    type: 'update_contact',
    label: 'Update contact',
    description: 'Sets or clears attributes, adds or removes labels, names the contact if blank.',
    icon: UserEditIcon,
    defaultSettings: () => ({
      setAttributes: {},
      clearAttributes: [],
      addLabels: [],
      removeLabels: [],
      nameIfBlank: '',
    }),
    outputs: () => [NEXT],
    preview: (s) => {
      const n =
        Object.keys((s.setAttributes as Any) ?? {}).length +
        ((s.clearAttributes as Any[]) ?? []).length +
        ((s.addLabels as Any[]) ?? []).length +
        ((s.removeLabels as Any[]) ?? []).length +
        (s.nameIfBlank ? 1 : 0);
      return `${n} change(s)`;
    },
    waitsFor: () => null,
    produces: () => [],
  },
  do_not_contact: {
    type: 'do_not_contact',
    label: 'Do not contact',
    description: "Marks, or clears, the contact's do-not-contact flag.",
    icon: BanIcon,
    defaultSettings: () => ({ mark: true }),
    outputs: () => [NEXT],
    preview: (s) => (s.mark === false ? 'Clear do-not-contact' : 'Mark do-not-contact'),
    waitsFor: () => null,
    produces: () => [],
  },
  assign_chat: {
    type: 'assign_chat',
    label: 'Assign chat',
    description: 'Gives the chat to an agent, a team queue or the next team member in turn.',
    icon: UsersIcon,
    defaultSettings: () => ({ mode: 'TEAM_QUEUE', userId: null, teamId: null, whenAway: null }),
    outputs: () => [NEXT],
    preview: (s, o) => {
      if (s.mode === 'AGENT') return `Assign to ${nameOf(o?.agents, s.userId, 'an agent')}`;
      const team = nameOf(o?.teams, s.teamId, 'a team');
      return s.mode === 'TEAM_ROUND_ROBIN' ? `Round robin in ${team}` : `Queue in ${team}`;
    },
    waitsFor: () => null,
    produces: () => ['assignedTo'],
  },
  add_to_crm: {
    type: 'add_to_crm',
    label: 'Add to CRM',
    description: 'Adds the person as a CRM contact with a deal, like the inbox button.',
    icon: BuildingIcon,
    defaultSettings: () => ({ pipelineId: null, stageId: null, dealTitle: '{{name}} – WhatsApp' }),
    outputs: () => [NEXT],
    preview: (s, o) => {
      const pipeline = o?.crm.pipelines.find((p) => p.id === s.pipelineId);
      return `Add to CRM (${pipeline?.name ?? 'default pipeline'})`;
    },
    waitsFor: () => null,
    produces: () => ['dealId', 'created'],
  },
  http_request: {
    type: 'http_request',
    label: 'HTTP request',
    description: 'Calls a URL with the variables; success on 2xx, failure otherwise.',
    icon: GlobeIcon,
    defaultSettings: () => ({ method: 'POST', url: '', headers: {}, body: '', contentType: 'application/json' }),
    outputs: () => [
      { id: 'success', label: 'Success' },
      { id: 'failure', label: 'Failure' },
    ],
    preview: (s) => cut(`${String(s.method ?? 'GET')} ${String(s.url ?? '')}`.trim()) || 'No URL yet',
    waitsFor: () => null,
    produces: () => ['response.status', 'response.body', 'response.headers'],
  },
  wait: {
    type: 'wait',
    label: 'Wait',
    description: 'Pauses the flow for a while, 1 minute to 30 days.',
    icon: ClockIcon,
    defaultSettings: () => ({ amount: 1, unit: 'HOURS' }),
    outputs: () => [NEXT],
    preview: (s) => `Wait ${String(s.amount ?? '')} ${String(s.unit ?? 'HOURS').toLowerCase()}`,
    waitsFor: () => 'TIMER',
    produces: () => [],
  },
  jump: {
    type: 'jump',
    label: 'Jump to chatbot',
    description: 'Ends this chatbot and starts another with the same variables.',
    icon: ArrowRightIcon,
    defaultSettings: () => ({ chatbotId: null }),
    outputs: () => [],
    preview: (s, o) => `Jump to ${nameOf(o?.chatbots, s.chatbotId, 'a chatbot')}`,
    waitsFor: () => null,
    produces: () => [],
  },
};

/** The palette, in the spec's order. */
export const PALETTE: NodeType[] = [
  'send_message',
  'send_template',
  'ask_question',
  'ask_form',
  'condition',
  'update_contact',
  'do_not_contact',
  'assign_chat',
  'add_to_crm',
  'http_request',
  'wait',
  'jump',
];

export const WAIT_LABELS: Record<TaskKind, string> = {
  WHATSAPP_REPLY: 'Waits for a WhatsApp reply',
  FORM: 'Waits for the form',
  TIMER: 'Waits',
  AI_RESPONSE: 'Waits for the AI',
};
