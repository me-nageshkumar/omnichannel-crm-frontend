import * as React from 'react';
import type { AdClickView, MessageView } from '@app/api/inbox';
import { STATUS_TICK, adLink } from '@app/Inbox/chatDisplay';
import { ContactCardBody } from '@app/Inbox/ContactCardBody';
import { MediaBody } from '@app/Inbox/MediaBody';
import { PollBody } from '@app/Inbox/PollBody';
import { formatWhatsApp } from '@app/Templates/placeholders';

const GAP = 'var(--pf-t--global--spacer--sm)';
const TICK_BLUE = 'var(--pf-t--global--icon--color--status--info--default)';
const TICK_RED = 'var(--pf-t--global--icon--color--status--danger--default)';

const MEDIA_TYPES = ['image', 'sticker', 'video', 'audio', 'ptt', 'document'];
const TEXT_TYPES = ['text', 'chat'];
/** Types WhatsApp Web itself does not show: the stored message holds nothing more than its type. */
const ONLY_ON_PHONE: Record<string, string> = {
  biz_content_placeholder: 'A business message only the phone can show',
  unknown: 'A message only the phone can show',
  newsletter_follower_invite: 'An invitation to follow a WhatsApp channel',
};

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const tickColor = (status: MessageView['status']) =>
  status === 'READ' || status === 'PLAYED' ? TICK_BLUE : status === 'FAILED' ? TICK_RED : undefined;

function Content({ message, contact }: { message: MessageView; contact: string }) {
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
  if (type === 'poll_creation') return <PollBody message={message} contact={contact} />;
  // a business message: text, often with an image or video, and any of it may be missing
  if (type === 'interactive' && (body || message.media)) {
    return (
      <>
        {message.media && <MediaBody chatId={message.chatId} message={message} />}
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
  if (type === 'vcard' || type === 'multi_vcard') return <ContactCardBody body={body} />;
  if (type === 'biz_content_placeholder' && message.businessTag === 'AUTHENTICATION') {
    return <em>A verification code only the phone can show</em>;
  }
  if (type === 'newsletter_follower_invite' && body) return <em>An invitation to follow the channel “{body}”</em>;
  if (ONLY_ON_PHONE[type]) return <em>{ONLY_ON_PHONE[type]}</em>;
  return <em>Unsupported message</em>;
}

function AdLine({ ad }: { ad: AdClickView }) {
  const text = ad.headline ?? ad.description ?? 'an ad';
  const href = adLink(ad.sourceUrl);
  return (
    <div style={{ color: 'var(--pf-t--global--text--color--subtle)', fontSize: 'var(--pf-t--global--font--size--sm)' }}>
      From ad:{' '}
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ) : (
        text
      )}
    </div>
  );
}

export interface MessageBubbleProps {
  message: MessageView;
  /** Incoming bubbles sit on the left, outgoing on the right. */
  side: 'left' | 'right';
  /** The contact of the chat, as a poll names its voters. */
  contact: string;
}

export const MessageBubble: React.FunctionComponent<MessageBubbleProps> = ({ message, side, contact }) => {
  const outgoing = message.direction === 'OUT';
  const tick = outgoing ? STATUS_TICK[message.status] : null;
  const source =
    message.source === 'CONSOLE'
      ? (message.sentBy?.name ?? 'Console')
      : message.source === 'CAMPAIGN'
        ? (message.sentBy?.name ?? 'Campaign')
        : message.source === 'AUTOMATION'
          ? (message.sentBy?.name ?? 'Automation')
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
        {message.adClick && <AdLine ad={message.adClick} />}
        <Content message={message} contact={contact} />
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
