import { apiFetch, apiFetchBlob } from '@app/api/client';
import type { PhoneNumber } from '@app/api/phoneNumbers';
import type { Availability } from '@app/api/users';

export type { Availability } from '@app/api/users';

export type ChatStatus = 'OPEN' | 'CLOSED';
export type MessageDirection = 'IN' | 'OUT';
/** Who produced the message: the contact, our console, or the phone / WhatsApp Web tab. */
export type MessageSource = 'CONTACT' | 'CONSOLE' | 'WHATSAPP_WEB' | 'CAMPAIGN';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'PLAYED' | 'FAILED';
export type ListScope = 'MINE' | 'TEAM' | 'UNASSIGNED' | 'ALL';
export type RoutingMode = 'NONE' | 'TEAM' | 'USER' | 'ROUND_ROBIN';
export type ActionType = 'ROUTED' | 'ASSIGNED' | 'UNASSIGNED' | 'CLOSED' | 'REOPENED' | 'TRANSFERRED';
/** Why a ROUTED action chose as it did, when it was not the plain routing setting. */
export type RoutedReason = 'STICKY' | 'HANDED_BACK' | 'OWNER_CHANGED' | 'MEMBER_REMOVED';

export interface IdName {
  id: string;
  name: string;
}

export interface ChatContact {
  id: string;
  name: string | null;
  phone: string | null;
  numberHidden: boolean;
}

export interface LastMessage {
  direction: MessageDirection;
  type: string;
  text: string | null;
  status: MessageStatus;
}

export interface ChatView {
  id: string;
  phoneNumberId: string;
  remoteId: string;
  contact: ChatContact;
  status: ChatStatus;
  assignedUser: IdName | null;
  assignedTeam: IdName | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessage: LastMessage | null;
  creationTime: string;
  /** The user who last handled the chat; a returning customer may stick to them. */
  lastAgent: IdName | null;
}

export interface MessageMedia {
  mimetype: string;
  filename: string | null;
  size: number;
  /** True once the bytes are cached on the server. */
  available: boolean;
}

export interface MessageLocation {
  latitude: number;
  longitude: number;
  description: string | null;
}

export interface StatusTimes {
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  playedAt: string | null;
  failedAt: string | null;
}

export interface MessageView {
  id: string;
  chatId: string;
  waMessageId: string;
  direction: MessageDirection;
  source: MessageSource;
  type: string;
  body: string | null;
  media: MessageMedia | null;
  location: MessageLocation | null;
  timestamp: string;
  status: MessageStatus;
  statusTimes: StatusTimes;
  sentBy: IdName | null;
  templateId: string | null;
}

export interface ActionView {
  id: string;
  type: ActionType;
  /** Null id when a campaign did it: the name is then "Campaign: <name>". */
  by: { id: string | null; name: string } | null;
  toUser: IdName | null;
  toTeam: IdName | null;
  at: string;
  reason: RoutedReason | null;
  /** On TRANSFERRED: the team the chat left. */
  fromTeam: IdName | null;
}

/** One line of a thread: exactly one of `message` / `action` is set, matching `kind`; `at` orders the items. */
export interface ThreadItem {
  kind: 'message' | 'action';
  message: MessageView | null;
  action: ActionView | null;
  at: string;
}

export interface ChatsPage {
  items: ChatView[];
  hasMore: boolean;
}

export interface ThreadPage {
  items: ThreadItem[];
  hasMore: boolean;
}

/**
 * A routing setting: the brand default (teamId null) or a team's; `inherited` is true when a team has no override
 * and the brand default is shown in its place. The server keeps a null field as it is.
 */
export interface RoutingSetting {
  teamId: string | null;
  inherited: boolean;
  assignToTeam: boolean;
  roundRobin: boolean;
  userId: string | null;
  stickyDays: number;
  claimOnReply: boolean;
  keepAssignmentOnClose: boolean;
}

export interface Assignees {
  users: Array<IdName & { username: string; availability: Availability }>;
  teams: IdName[];
}

export type HandoffBody = { kind: 'TO_USER'; userId: string } | { kind: 'TO_TEAM'; teamId?: string };

export type InboxEvent =
  | { type: 'chat'; chat: ChatView; visible: boolean }
  | { type: 'message'; chatId: string; message: MessageView }
  | { type: 'action'; chatId: string; action: ActionView };

export interface ChatFilters {
  /** The numbers to list; empty or absent means every number the viewer may open. */
  phoneNumberIds?: string[];
  scope?: ListScope;
  status?: ChatStatus | 'ALL';
  q?: string;
  unread?: boolean;
  before?: string;
  limit?: number;
}

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/inbox`;
const chatPath = (ws: string, chatId: string) => `${base(ws)}/chats/${encodeURIComponent(chatId)}`;
const post = <T>(token: string, path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', token, body });

export const listInboxNumbers = (token: string, ws: string) =>
  apiFetch<PhoneNumber[]>(`${base(ws)}/phone-numbers`, { token });

/** One page of the viewer's chats across their numbers, newest message first. */
export function listChats(token: string, ws: string, filters: ChatFilters = {}): Promise<ChatsPage> {
  const query = new URLSearchParams();
  if (filters.phoneNumberIds && filters.phoneNumberIds.length > 0) {
    query.set('phoneNumberIds', filters.phoneNumberIds.join(','));
  }
  if (filters.scope) query.set('scope', filters.scope);
  if (filters.status) query.set('status', filters.status);
  if (filters.q) query.set('q', filters.q);
  if (filters.unread) query.set('unread', 'true');
  if (filters.before) query.set('before', filters.before);
  if (filters.limit !== undefined) query.set('limit', String(filters.limit));
  const qs = query.toString();
  return apiFetch<ChatsPage>(`${base(ws)}/chats${qs ? `?${qs}` : ''}`, { token });
}

export const getChat = (token: string, ws: string, chatId: string) =>
  apiFetch<ChatView>(chatPath(ws, chatId), { token });

export const getThread = (token: string, ws: string, chatId: string, before?: string) =>
  apiFetch<ThreadPage>(
    `${chatPath(ws, chatId)}/thread${before ? `?${new URLSearchParams({ before }).toString()}` : ''}`,
    { token },
  );

export const markRead = (token: string, ws: string, chatId: string) =>
  post<void>(token, `${chatPath(ws, chatId)}/read`);

export const sendText = (token: string, ws: string, chatId: string, text: string) =>
  post<MessageView>(token, `${chatPath(ws, chatId)}/messages`, { text });

export const sendTemplate = (
  token: string,
  ws: string,
  chatId: string,
  templateId: string,
  values: Record<string, string>,
) => post<MessageView>(token, `${chatPath(ws, chatId)}/messages`, { templateId, values });

export type NewChatBody =
  | { phone: string; text: string }
  | { phone: string; templateId: string; values: Record<string, string> };

/** Starts a chat with a phone number by sending its first message (text, or a template). */
export const startChat = (token: string, ws: string, pn: string, body: NewChatBody) =>
  post<MessageView>(token, `${base(ws)}/phone-numbers/${encodeURIComponent(pn)}/chats`, body);

export interface NumberLookup {
  phone: string;
  registered: boolean;
  remoteId: string | null;
  checkedAt: string;
  cached: boolean;
}

/** Asks whether a phone number is on WhatsApp; `force` skips the cached answer. */
export const lookupNumber = (token: string, ws: string, pn: string, phone: string, force = false) =>
  apiFetch<NumberLookup>(
    `${base(ws)}/phone-numbers/${encodeURIComponent(pn)}/number-lookup?phone=${encodeURIComponent(phone)}${
      force ? '&force=true' : ''
    }`,
    { token },
  );

export const assignChat = (token: string, ws: string, chatId: string, target: { userId?: string; teamId?: string }) =>
  post<ChatView>(token, `${chatPath(ws, chatId)}/assign`, target);

export const unassignChat = (token: string, ws: string, chatId: string) =>
  post<ChatView>(token, `${chatPath(ws, chatId)}/unassign`);

export const closeChat = (token: string, ws: string, chatId: string) =>
  post<ChatView>(token, `${chatPath(ws, chatId)}/close`);

export const reopenChat = (token: string, ws: string, chatId: string) =>
  post<ChatView>(token, `${chatPath(ws, chatId)}/reopen`);

/** The caller takes an unassigned chat; 409 CHAT_TAKEN when someone was quicker. */
export const claimChat = (token: string, ws: string, chatId: string) =>
  post<ChatView>(token, `${chatPath(ws, chatId)}/claim`);

/** The assignee passes the chat to a teammate, back to the team, or to another team. */
export const handoffChat = (token: string, ws: string, chatId: string, body: HandoffBody) =>
  post<ChatView>(token, `${chatPath(ws, chatId)}/handoff`, body);

/** Who a chat may be assigned to; with a number, only people who can open that number. */
export const getAssignees = (token: string, ws: string, phoneNumberId?: string) =>
  apiFetch<Assignees>(
    `${base(ws)}/assignees${phoneNumberId ? `?${new URLSearchParams({ phoneNumberId }).toString()}` : ''}`,
    { token },
  );

const settingsPath = (ws: string) => `${base(ws)}/settings`;
const teamSettingsPath = (ws: string, teamId: string) => `${settingsPath(ws)}/teams/${encodeURIComponent(teamId)}`;

export const getRoutingDefault = (token: string, ws: string) => apiFetch<RoutingSetting>(settingsPath(ws), { token });

export const putRoutingDefault = (token: string, ws: string, setting: RoutingSetting) =>
  apiFetch<RoutingSetting>(settingsPath(ws), { method: 'PUT', token, body: setting });

/** One entry per team: its override, or the brand default flagged inherited. */
export const listTeamRouting = (token: string, ws: string) =>
  apiFetch<RoutingSetting[]>(`${settingsPath(ws)}/teams`, { token });

export const putTeamRouting = (token: string, ws: string, teamId: string, setting: RoutingSetting) =>
  apiFetch<RoutingSetting>(teamSettingsPath(ws, teamId), { method: 'PUT', token, body: setting });

/** Back to the brand default. */
export const deleteTeamRouting = (token: string, ws: string, teamId: string) =>
  apiFetch<void>(teamSettingsPath(ws, teamId), { method: 'DELETE', token });

/** Where a message's media is served; fetch it with {@link fetchMedia}, since it needs the auth header. */
export const chatMediaUrl = (ws: string, chatId: string, messageId: string) =>
  `${chatPath(ws, chatId)}/messages/${encodeURIComponent(messageId)}/media`;

/**
 * The viewer's SSE endpoint over the selected numbers (all visible ones when empty); the stream hook reads it with
 * `fetch` so the Bearer header can be sent.
 */
export const streamUrl = (ws: string, phoneNumberIds: string[]) =>
  `${base(ws)}/stream${
    phoneNumberIds.length > 0 ? `?${new URLSearchParams({ phoneNumberIds: phoneNumberIds.join(',') }).toString()}` : ''
  }`;

export const fetchMedia = (token: string, url: string): Promise<Blob> => apiFetchBlob(url, token);

/**
 * Splits the text read so far into complete SSE frames (ended by a blank line) and the unfinished tail.
 * Comment lines (`:` ping) are ignored, multiple `data:` lines join with a newline, and both `\n` and
 * `\r\n` line endings are accepted. A frame with no data (a bare ping) yields no event.
 */
export function parseSse(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const text = buffer.replace(/\r\n/g, '\n');
  const cut = text.lastIndexOf('\n\n');
  if (cut < 0) return { events: [], rest: text };
  const events: Array<{ event: string; data: string }> = [];
  for (const frame of text.slice(0, cut).split('\n\n')) {
    let event = 'message';
    const data: string[] = [];
    for (const line of frame.split('\n')) {
      if (line === '' || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length > 0) events.push({ event, data: data.join('\n') });
  }
  return { events, rest: text.slice(cut + 2) };
}

/** The typed event for one SSE frame, or null for an unknown event name or unparseable data. */
export function toInboxEvent(event: string, data: string): InboxEvent | null {
  if (event !== 'chat' && event !== 'message' && event !== 'action') return null;
  try {
    return { type: event, ...JSON.parse(data) } as InboxEvent;
  } catch {
    return null;
  }
}
