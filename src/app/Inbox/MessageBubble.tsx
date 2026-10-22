import * as React from 'react';
import type { MessageView } from '@app/api/inbox';
import { STATUS_TICK } from '@app/Inbox/chatDisplay';
import { MediaBody } from '@app/Inbox/MediaBody';
import { formatWhatsApp } from '@app/Templates/placeholders';

const GAP = 'var(--pf-t--global--spacer--sm)';
const TICK_BLUE = 'var(--pf-t--global--icon--color--status--info--default)';
const TICK_RED = 'var(--pf-t--global--icon--color--status--danger--default)';

const MEDIA_TYPES = ['image', 'sticker', 'video', 'audio', 'ptt', 'document'];
const TEXT_TYPES = ['text', 'chat'];

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const tickColor = (status: MessageView['status']) =>
  status === 'READ' || status === 'PLAYED' ? TICK_BLUE : status === 'FAILED' ? TICK_RED : undefined;

function Content({ message }: { message: MessageView }) {
  const { type, body, location } = message;
  if (type === 'revoked') return <em>This message was deleted</em>;
  if (type === 'location' && location) {
    const href = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {location.description ?? 'Location'}
      </a>
    );
  }
  if (type === 'poll_creation') {
    return (
      <>
        <small style={{ display: 'block' }}>Poll</small>
        {body && <div>{formatWhatsApp(body)}</div>}
      </>
    );
  }
  if (MEDIA_TYPES.includes(type)) {
    return (
      <>
        {message.media ? <MediaBody chatId={message.chatId} message={message} /> : <em>Media not available</em>}
        {body && <div>{formatWhatsApp(body)}</div>}
      </>
    );
  }
  if (TEXT_TYPES.includes(type)) return <div>{body ? formatWhatsApp(body) : null}</div>;
  return <em>Unsupported message</em>;
}

export interface MessageBubbleProps {
  message: MessageView;
  /** Incoming bubbles sit on the left, outgoing on the right. */
  side: 'left' | 'right';
}

export const MessageBubble: React.FunctionComponent<MessageBubbleProps> = ({ message, side }) => {
  const outgoing = message.direction === 'OUT';
  const tick = outgoing ? STATUS_TICK[message.status] : null;
  const source =
    message.source === 'CONSOLE'
      ? (message.sentBy?.name ?? 'Console')
      : message.source === 'CAMPAIGN'
        ? (message.sentBy?.name ?? 'Campaign')
        : 'WhatsApp Web';
  return (
    <div style={{ display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
      <div
        data-side={side}
        style={{
          maxWidth: '75%',
          padding: GAP,
          borderRadius: 8,
          border: '1px solid var(--pf-t--global--border--color--default)',
          background:
            side === 'right'
              ? 'var(--pf-t--global--background--color--secondary--default)'
              : 'var(--pf-t--global--background--color--primary--default)',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        <Content message={message} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: GAP,
            marginTop: 4,
            whiteSpace: 'normal',
            color: 'var(--pf-t--global--text--color--subtle)',
          }}
        >
          {outgoing && <small>{source}</small>}
          <small>{timeOf(message.timestamp)}</small>
          {tick && (
            <small role="img" aria-label={tick.label} style={{ color: tickColor(message.status) }}>
              {tick.glyph}
            </small>
          )}
        </div>
      </div>
    </div>
  );
};
