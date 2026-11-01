import { apiFetch } from '@app/api/client';

export type HistoryImportStatus = 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type HistoryScopeKind = 'ALL' | 'CHATS';
/** Why a queued or running import is not moving: no connected device, or WhatsApp Web not ready. */
export type HistoryWaiting = 'NO_DEVICE' | 'WHATSAPP_NOT_READY' | null;
export type HistoryChatStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'SKIPPED' | 'FAILED';

export interface HistoryImportCounts {
  chatsTotal: number;
  chatsDone: number;
  chatsSkipped: number;
  chatsFailed: number;
  messagesSeen: number;
  messagesInserted: number;
  messagesUpdated: number;
}

/** One history import as the console shows it. */
export interface HistoryImportView {
  id: string;
  phoneNumber: { id: string; number: string; label: string | null };
  scope: { kind: HistoryScopeKind; phones: string[]; chatCount: number };
  range: { from: string | null; to: string | null };
  status: HistoryImportStatus;
  waiting: HistoryWaiting;
  counts: HistoryImportCounts;
  requestedBy: { id: string; name: string } | null;
  creationTime: string;
  startedAt: string | null;
  finishedAt: string | null;
  progressPercent: number | null;
  error: string | null;
}

/** One chat inside an import. */
export interface HistoryChatView {
  id: string;
  remoteId: string;
  requestedPhone: string | null;
  chatName: string | null;
  chatId: string | null;
  status: HistoryChatStatus;
  skipReason: 'NO_CHAT' | null;
  error: string | null;
  counts: { seen: number; inserted: number; updated: number };
  capped: boolean;
  /** WhatsApp Web stopped giving older messages although it did not say there are none. */
  olderUnavailable: boolean;
  attemptedAt: string | null;
  finishedAt: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
}

export interface NumberImportRequest {
  scope: { kind: 'ALL' } | { kind: 'CHATS'; phones: string[] };
  from?: string | null;
  to?: string | null;
}

export interface RangeRequest {
  from?: string | null;
  to?: string | null;
}

export const ACTIVE: ReadonlySet<HistoryImportStatus> = new Set<HistoryImportStatus>(['QUEUED', 'RUNNING', 'PAUSED']);

/** True until an import has ended: queued, running or paused. */
export const isActive = (s: HistoryImportStatus) => ACTIVE.has(s);

/** True while an import is queued or running: it can be paused. */
export const isFetching = (s: HistoryImportStatus) => s === 'QUEUED' || s === 'RUNNING';

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/inbox`;
const importPath = (ws: string, id: string) => `${base(ws)}/history-imports/${encodeURIComponent(id)}`;
const withQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) query.set(k, String(v));
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
};

/** Starts importing a number's history: every chat, or the listed phone numbers' chats. */
export const startNumberImport = (token: string, ws: string, phoneNumberId: string, body: NumberImportRequest) =>
  apiFetch<HistoryImportView>(`${base(ws)}/phone-numbers/${encodeURIComponent(phoneNumberId)}/history-imports`, {
    token,
    method: 'POST',
    body,
  });

/** Starts importing one chat's history. */
export const startChatImport = (token: string, ws: string, chatId: string, body: RangeRequest) =>
  apiFetch<HistoryImportView>(`${base(ws)}/chats/${encodeURIComponent(chatId)}/history-imports`, {
    token,
    method: 'POST',
    body,
  });

/** The queued, running or paused import that names this chat, if there is one. */
export const getActiveChatImport = (token: string, ws: string, chatId: string) =>
  apiFetch<HistoryImportView | undefined>(`${base(ws)}/chats/${encodeURIComponent(chatId)}/history-imports/active`, {
    token,
  });

export const listHistoryImports = (
  token: string,
  ws: string,
  opts: { phoneNumberId?: string; status?: HistoryImportStatus; page?: number } = {},
) =>
  apiFetch<Page<HistoryImportView>>(
    withQuery(`${base(ws)}/history-imports`, {
      phoneNumberId: opts.phoneNumberId,
      status: opts.status,
      page: opts.page,
    }),
    { token },
  );

export const getHistoryImport = (token: string, ws: string, id: string) =>
  apiFetch<HistoryImportView>(importPath(ws, id), { token });

export const listHistoryImportChats = (
  token: string,
  ws: string,
  id: string,
  opts: { status?: HistoryChatStatus; page?: number } = {},
) =>
  apiFetch<Page<HistoryChatView>>(withQuery(`${importPath(ws, id)}/chats`, { status: opts.status, page: opts.page }), {
    token,
  });

export const pauseHistoryImport = (token: string, ws: string, id: string) =>
  apiFetch<HistoryImportView>(`${importPath(ws, id)}/pause`, { token, method: 'POST' });

export const resumeHistoryImport = (token: string, ws: string, id: string) =>
  apiFetch<HistoryImportView>(`${importPath(ws, id)}/resume`, { token, method: 'POST' });

export const cancelHistoryImport = (token: string, ws: string, id: string) =>
  apiFetch<HistoryImportView>(`${importPath(ws, id)}/cancel`, { token, method: 'POST' });
