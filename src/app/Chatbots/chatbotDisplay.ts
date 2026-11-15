import type { ChatbotStatus, RunStatus, Waiting } from '@app/api/chatbots';

export const statusLabel = (s: ChatbotStatus): string => (s === 'PUBLISHED' ? 'Published' : 'Draft');
export const statusColor = (s: ChatbotStatus): 'green' | 'grey' => (s === 'PUBLISHED' ? 'green' : 'grey');

const RUN_LABELS: Record<RunStatus, string> = {
  RUNNING: 'Running',
  WAITING: 'Waiting',
  COMPLETED: 'Completed',
  ENDED: 'Ended',
  STOPPED: 'Stopped',
  HANDED_OVER: 'Handed over',
  JUMPED: 'Jumped',
  FAILED: 'Failed',
};

export const runStatusLabel = (s: RunStatus): string => RUN_LABELS[s] ?? s;

export const runStatusColor = (s: RunStatus): 'blue' | 'green' | 'grey' | 'red' | 'orange' | 'purple' => {
  switch (s) {
    case 'RUNNING':
    case 'WAITING':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'FAILED':
      return 'red';
    case 'ENDED':
      return 'orange';
    case 'HANDED_OVER':
    case 'JUMPED':
      return 'purple';
    default:
      return 'grey';
  }
};

/** "for a WhatsApp reply", "for the form", "until <time>", or '' when nothing is waited for. */
export function waitingLabel(w: Waiting | null | undefined): string {
  if (!w) return '';
  if (w.kind === 'WHATSAPP_REPLY') return 'for a WhatsApp reply';
  if (w.kind === 'FORM') return 'for the form';
  if (w.kind === 'AI_RESPONSE') return 'for the AI';
  if (w.key && /^\d{13}$/.test(w.key)) return `until ${new Date(Number(w.key)).toLocaleString()}`;
  return 'for the timer';
}

export const RUN_STATUSES: RunStatus[] = [
  'RUNNING',
  'WAITING',
  'COMPLETED',
  'ENDED',
  'STOPPED',
  'HANDED_OVER',
  'JUMPED',
  'FAILED',
];

export const AI_THINKING = 'The AI is thinking…';

const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);

/**
 * One line about an AI step, from the node's variables (`turns`, `lastReply` or `reply`, `outcome`, `usage`), e.g.
 * "Turn 2 · We have red shirts… · Outcome: booked · 120 in / 45 out tokens"; null for other nodes or no variables.
 */
export function aiStepDetail(type: string, vars: unknown): string | null {
  if (type !== 'ai' || !vars || typeof vars !== 'object') return null;
  const v = vars as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof v.turns === 'number') parts.push(`Turn ${v.turns}`);
  const reply = typeof v.lastReply === 'string' ? v.lastReply : typeof v.reply === 'string' ? v.reply : null;
  if (reply) parts.push(cut(reply, 200));
  if (typeof v.outcome === 'string' && v.outcome !== '') parts.push(`Outcome: ${v.outcome}`);
  const usage = v.usage as Record<string, unknown> | undefined;
  if (usage && typeof usage.inputTokens === 'number') {
    parts.push(`${usage.inputTokens} in / ${Number(usage.outputTokens ?? 0)} out tokens`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
