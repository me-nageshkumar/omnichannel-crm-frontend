import type {
  HistoryChatStatus,
  HistoryChatView,
  HistoryImportCounts,
  HistoryImportStatus,
  HistoryImportView,
  HistoryWaiting,
} from '@app/api/historyImports';

const STATUS_TEXT: Record<HistoryImportStatus, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Stopped',
  FAILED: 'Failed',
};

const STATUS_COLOR: Record<HistoryImportStatus, 'grey' | 'blue' | 'green' | 'orange' | 'red'> = {
  QUEUED: 'grey',
  RUNNING: 'blue',
  PAUSED: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'orange',
  FAILED: 'red',
};

export const HISTORY_STATUSES = Object.keys(STATUS_TEXT) as HistoryImportStatus[];

export const statusLabel = (s: HistoryImportStatus): string => STATUS_TEXT[s];

export const statusColor = (s: HistoryImportStatus): 'grey' | 'blue' | 'green' | 'orange' | 'red' => STATUS_COLOR[s];

/** Which chats the import covers. */
export const scopeText = (v: HistoryImportView): string =>
  v.scope.kind === 'ALL' ? 'All chats' : `${v.scope.chatCount} contact(s)`;

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '…');

/** The imported period; an open end shows as "…". */
export const rangeText = (v: HistoryImportView): string =>
  !v.range.from && !v.range.to ? 'All time' : `${day(v.range.from)} – ${day(v.range.to)}`;

/** Why a queued or running import is not moving, or null. */
export function waitingText(w: HistoryWaiting): string | null {
  if (w === 'NO_DEVICE') return 'Waiting for the extension to connect';
  if (w === 'WHATSAPP_NOT_READY') return 'Waiting for WhatsApp Web to be ready';
  return null;
}

/** The line above a thread while its import has not ended. */
export function progressText(v: HistoryImportView): string {
  if (v.status === 'PAUSED') return `History import paused: ${v.counts.messagesSeen} messages so far`;
  const waiting = waitingText(v.waiting);
  return `Importing history… ${v.counts.messagesSeen} messages so far${waiting ? ` — ${waiting}` : ''}`;
}

/** The line above a thread once its import was stopped: what was fetched stays. */
export const stoppedText = (v: HistoryImportView): string =>
  `History import stopped: ${v.counts.messagesSeen} messages fetched`;

/** True for a completed import none of whose chats failed or was skipped. */
export const completedCleanly = (v: HistoryImportView): boolean =>
  v.status === 'COMPLETED' && v.counts.chatsFailed === 0 && v.counts.chatsSkipped === 0;

/** Why an import failed, as people read it. */
export const importErrorText = (code: string): string =>
  code === 'NUMBER_GONE' ? 'The phone number was removed' : code;

export const countsText = (c: HistoryImportCounts): string =>
  `${c.messagesInserted} new · ${c.messagesUpdated} updated · ${c.messagesSeen} seen`;

const CHAT_STATUS_TEXT: Record<HistoryChatStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  DONE: 'Done',
  SKIPPED: 'Skipped',
  FAILED: 'Failed',
};

export const chatStatusLabel = (s: HistoryChatStatus): string => CHAT_STATUS_TEXT[s];

/** Why a chat was skipped, failed or ended early; null when there is nothing to say. */
export function chatNote(c: HistoryChatView): string | null {
  if (c.skipReason === 'NO_CHAT') return 'No chat on the phone';
  if (c.error) return c.error;
  if (c.olderUnavailable) return 'WhatsApp Web gave no older messages';
  return c.capped ? 'Capped' : null;
}
