import type { ChatbotStatus, RunEnding, RunStatus, Waiting } from '@app/api/chatbots';

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
 * One line about an AI step, from the node's variables (`lastReply` or `reply`, `outcome`, `usage`), e.g.
 * "We have red shirts… · Outcome: booked · 120 in / 45 out tokens"; the step's summary already names the turn. Null
 * for other nodes or no variables.
 */
export function aiStepDetail(type: string, vars: unknown): string | null {
  if (type !== 'ai' || !vars || typeof vars !== 'object') return null;
  const v = vars as Record<string, unknown>;
  const parts: string[] = [];
  const reply = typeof v.lastReply === 'string' ? v.lastReply : typeof v.reply === 'string' ? v.reply : null;
  if (reply) parts.push(cut(reply, 200));
  if (typeof v.outcome === 'string' && v.outcome !== '') parts.push(`Outcome: ${v.outcome}`);
  const usage = v.usage as Record<string, unknown> | undefined;
  if (usage && typeof usage.inputTokens === 'number') {
    parts.push(`${usage.inputTokens} in / ${Number(usage.outputTokens ?? 0)} out tokens`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ---- chatbot report (spec 2026-11-20 §6.5) ----

/** The local days typed as `YYYY-MM-DD`, as the instants the first one starts and the last one ends. */
export function localDayRange(from: string, to: string): { from: string; to: string } {
  return {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59.999`).toISOString(),
  };
}

/** True for a real calendar day written `YYYY-MM-DD` (not `2026-13-01`, `2026-02-29` or a half-typed date). */
export function validDay(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * True when the `YYYY-MM-DD` days span more than 92 whole days. The server caps the span from the first day's
 * start to the last day's end at 92 days, so 92 days apart (93 days inclusive) is already too long.
 */
export function rangeTooLong(from: string, to: string): boolean {
  const day = (v: string) => {
    const [y, m, d] = v.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return (day(to) - day(from)) / 86_400_000 >= 92;
}

/** The non-empty buckets of runs by how many details they gave: `count` details, `runs` runs, the words to show. */
export function progressParts(byCount: number[]): { count: number; runs: number; text: string }[] {
  return byCount
    .map((runs, count) => ({
      count,
      runs,
      text: `${count === 0 ? 'gave nothing' : count === 1 ? '1 detail' : `${count} details`} ${runs}`,
    }))
    .filter((p) => p.runs > 0);
}

/** "gave nothing 12 · 1 detail 9 · 2 details 11": runs by how many details they gave, empty buckets left out. */
export function progressSummary(byCount: number[]): string {
  return progressParts(byCount)
    .map((p) => p.text)
    .join(' · ');
}

/** "name 29 · city 20": how many runs gave each detail, by its label or else its key. */
export function fieldsSummary(fields: { key: string; label: string | null; given: number }[]): string {
  return fields.map((f) => `${f.label || f.key} ${f.given}`).join(' · ');
}

/** "Collected: name, city": the details an AI step has so far (keys with a value), or null when none. */
export function collectedText(progress: Record<string, unknown> | null | undefined): string | null {
  if (!progress) return null;
  const keys = Object.keys(progress).filter((k) => {
    const v = progress[k];
    return v !== null && v !== undefined && v !== '';
  });
  return keys.length > 0 ? `Collected: ${keys.join(', ')}` : null;
}

const ENDING_LABELS: Record<RunEnding['chat'], string> = {
  HANDED_OVER: 'Handed over',
  ROUTED: 'Sent to the team',
  CLOSED: 'Closed by the chatbot',
  LEFT: 'Taken by someone else',
};

/** "Chat: Handed over · Asha": where a finished run's chat went, or null when not recorded. */
export function endingText(e: RunEnding | null | undefined): string | null {
  if (!e) return null;
  let who = '';
  if (e.chat === 'HANDED_OVER' || e.chat === 'ROUTED') {
    if (e.agent?.name) who = ` · ${e.agent.name}`;
    else if (e.team?.name) who = ` · waiting in ${e.team.name}`;
  }
  return `Chat: ${ENDING_LABELS[e.chat] ?? e.chat}${who}`;
}
