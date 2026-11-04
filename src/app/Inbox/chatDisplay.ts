import type { ChatContact, ChatStatus, ListScope, MessageStatus, MessageView } from '@app/api/inbox';
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

/**
 * The lists the user may look at: their own always; the unassigned (their teams' queue) with view-queue; the team's
 * too with view-team; all with view-all.
 */
export function allowedScopes(access: Pick<Access, 'hasInWorkspace'>): ListScope[] {
  const scopes: ListScope[] = ['MINE'];
  if (access.hasInWorkspace('inbox:view-team')) scopes.push('TEAM');
  if (access.hasInWorkspace('inbox:view-team') || access.hasInWorkspace('inbox:view-queue')) scopes.push('UNASSIGNED');
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

/** How many votes, as a phrase. */
export const votesText = (n: number): string => `${n} ${n === 1 ? 'vote' : 'votes'}`;

function durationText(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) {
    const left = seconds % 60;
    return `${Math.floor(seconds / 60)} min${left ? ` ${left} s` : ''}`;
  }
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${Math.floor(seconds / 3600)} h${minutes ? ` ${minutes} min` : ''}`;
}

/** A call as one line; it says "voice" nowhere, as a call that does not say it is video may still be one. */
export function callText({ call, direction }: Pick<MessageView, 'call' | 'direction'>): string {
  const kind = call?.video ? 'video call' : 'call';
  if (call?.missed) {
    if (direction === 'IN') return `Missed ${kind}`;
    return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} not answered`;
  }
  const label = `${direction === 'OUT' ? 'Outgoing' : 'Incoming'} ${kind}`;
  return call?.durationSeconds ? `${label} · ${durationText(call.durationSeconds)}` : label;
}

/** The ad's URL when it is safe to link (http or https), else null. */
export const adLink = (url: string | null): string | null => (url && /^https?:\/\//.test(url) ? url : null);
