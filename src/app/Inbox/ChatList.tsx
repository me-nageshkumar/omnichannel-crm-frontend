import * as React from 'react';
import {
  Alert,
  Badge,
  Button,
  SearchInput,
  Spinner,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import type { ChatView } from '@app/api/inbox';
import { ChatListFilters, SCOPE_TEXT, STATUS_TICK, allowedScopes, contactName } from '@app/Inbox/chatDisplay';
import type { ChatList as ChatListState } from '@app/Inbox/useChatList';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useAccess } from '@app/session/useAccess';

const GAP = 'var(--pf-t--global--spacer--sm)';
const TICK_BLUE = 'var(--pf-t--global--icon--color--status--info--default)';

const Row: React.FunctionComponent<{ chat: ChatView; selected: boolean; onSelect: (chat: ChatView) => void }> = ({
  chat,
  selected,
  onSelect,
}) => {
  const last = chat.lastMessage;
  const tick = last?.direction === 'OUT' ? STATUS_TICK[last.status] : null;
  const read = last?.status === 'READ' || last?.status === 'PLAYED';
  const preview = last ? (last.text ?? `[${last.type.toLowerCase()}]`) : '';
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(chat)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: GAP,
          width: '100%',
          padding: GAP,
          border: 0,
          borderBottom: '1px solid var(--pf-t--global--border--color--default)',
          background: selected ? 'var(--pf-t--global--background--color--action--plain--clicked)' : 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--pf-t--global--background--color--secondary--default)',
            fontWeight: 600,
          }}
        >
          {chat.contact.name ? chat.contact.name.charAt(0).toUpperCase() : '#'}
        </span>
        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: GAP }}>
            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contactName(chat)}
            </strong>
            {chat.lastMessageAt && <small style={{ flex: '0 0 auto' }}>{relative(chat.lastMessageAt)}</small>}
          </span>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: GAP }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tick && (
                <span role="img" aria-label={tick.label} style={read ? { color: TICK_BLUE } : undefined}>
                  {tick.glyph}
                </span>
              )}
              {tick && ' '}
              {preview}
            </span>
            {chat.unreadCount > 0 && <Badge>{chat.unreadCount}</Badge>}
          </span>
        </span>
      </button>
    </li>
  );
};

export interface ChatListProps {
  phoneNumberId: string;
  selectedId: string | null;
  onSelect: (chat: ChatView) => void;
  filters: ChatListFilters;
  onFilters: (filters: ChatListFilters) => void;
  list: ChatListState;
}

/** The left pane of the inbox: filters on top, the chats below, scrolling on their own. */
export const ChatList: React.FunctionComponent<ChatListProps> = ({
  phoneNumberId,
  selectedId,
  onSelect,
  filters,
  onFilters,
  list,
}) => {
  const scopes = allowedScopes(useAccess());
  const set = (change: Partial<ChatListFilters>) => onFilters({ ...filters, ...change });
  return (
    <div
      data-phone-number={phoneNumberId}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, padding: GAP, flex: '0 0 auto' }}>
        <SearchInput
          aria-label="Search chats"
          placeholder="Search by name or number"
          value={filters.q}
          onChange={(_e, v) => set({ q: v })}
          onClear={() => set({ q: '' })}
        />
        {scopes.length > 1 && (
          <ToggleGroup aria-label="Scope" isCompact>
            {scopes.map((s) => (
              <ToggleGroupItem
                key={s}
                text={SCOPE_TEXT[s]}
                isSelected={filters.scope === s}
                onChange={() => set({ scope: s })}
              />
            ))}
          </ToggleGroup>
        )}
        <ToggleGroup aria-label="Status" isCompact>
          <ToggleGroupItem
            text="Open"
            isSelected={filters.status === 'OPEN'}
            onChange={() => set({ status: 'OPEN' })}
          />
          <ToggleGroupItem
            text="Closed"
            isSelected={filters.status === 'CLOSED'}
            onChange={() => set({ status: 'CLOSED' })}
          />
        </ToggleGroup>
        <Switch
          id="chat-list-unread"
          label="Unread only"
          isChecked={filters.unread}
          onChange={(_e, on) => set({ unread: on })}
        />
      </div>
      {list.error && <Alert variant="danger" isInline title={list.error} />}
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        {list.items.length > 0 && (
          <ul aria-label="Chats" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list.items.map((chat) => (
              <Row key={chat.id} chat={chat} selected={chat.id === selectedId} onSelect={onSelect} />
            ))}
          </ul>
        )}
        {list.loading && list.items.length === 0 && <Spinner aria-label="Loading chats" />}
        {!list.loading && !list.error && list.items.length === 0 && <p style={{ padding: GAP }}>No chats</p>}
        {list.hasMore && (
          <div style={{ padding: GAP }}>
            <Button variant="link" onClick={list.loadMore} isDisabled={list.loading} isLoading={list.loading}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
