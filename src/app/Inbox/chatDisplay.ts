import type { ChatContact, ChatStatus, ListScope, MessageStatus } from '@app/api/inbox';
import type { Access } from '@app/session/useAccess';

/** The list's filters as the pane edits them; `q` is the raw search text. */
export interface ChatListFilters {
  scope: ListScope;
  status: ChatStatus;
  q: string;
  unread: boolean;
}

/** Display order of the scope toggle. */
export const SCOPE_TEXT: Record<ListScope, string> = {
  MINE: 'Mine',
  TEAM: 'Team',
  UNASSIGNED: 'Unassigned',
  ALL: 'All',
};

/** Who the contact is: name, else `+phone`, else a hidden number. */
export function contactName(chat: { contact: Pick<ChatContact, 'name' | 'phone'> }): string {
  const { name, phone } = chat.contact;
  if (name) return name;
  return phone ? `+${phone}` : 'Number hidden';
}

/** The lists the user may look at: their own always, the team's and the unassigned with view-team, all with view-all. */
export function allowedScopes(access: Pick<Access, 'hasInWorkspace'>): ListScope[] {
  const scopes: ListScope[] = ['MINE'];
  if (access.hasInWorkspace('inbox:view-team')) scopes.push('TEAM', 'UNASSIGNED');
  if (access.hasInWorkspace('inbox:view-all')) scopes.push('ALL');
  return scopes;
}

/** The widest of the allowed scopes: All, then Team, then Mine. */
export function defaultScope(scopes: ListScope[]): ListScope {
  return (['ALL', 'TEAM', 'MINE'] as const).find((s) => scopes.includes(s)) ?? 'MINE';
}

export const defaultFilters = (access: Pick<Access, 'hasInWorkspace'>): ChatListFilters => ({
  scope: defaultScope(allowedScopes(access)),
  status: 'OPEN',
  q: '',
  unread: false,
});

/** Tick marks for the delivery state of an outbound message. */
export const STATUS_TICK: Record<MessageStatus, { label: string; glyph: string }> = {
  PENDING: { label: 'Pending', glyph: '🕓' },
  SENT: { label: 'Sent', glyph: '✓' },
  DELIVERED: { label: 'Delivered', glyph: '✓✓' },
  READ: { label: 'Read', glyph: '✓✓' },
  PLAYED: { label: 'Played', glyph: '✓✓' },
  FAILED: { label: 'Failed', glyph: '!' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The separator above a day of the thread: "Today", "Yesterday", else `d MMM yyyy` (local days). */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const ago = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
