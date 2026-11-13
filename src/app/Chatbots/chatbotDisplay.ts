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
  if (w.key && /^\d{13}$/.test(w.key)) return `until ${new Date(Number(w.key)).toLocaleString()}`;
  return 'for the timer';
}

export const RUN_STATUSES: RunStatus[] = ['RUNNING', 'WAITING', 'COMPLETED', 'ENDED', 'STOPPED', 'HANDED_OVER', 'JUMPED', 'FAILED'];
