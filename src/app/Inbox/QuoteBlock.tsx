import * as React from 'react';
import type { QuotedView } from '@app/api/inbox';

const MEDIA: Record<string, [string, string]> = {
  image: ['📷', 'Photo'],
  video: ['🎥', 'Video'],
  audio: ['🎤', 'Audio'],
  document: ['📄', 'Document'],
  sticker: ['', 'Sticker'],
  location: ['📍', 'Location'],
};

export const EARLIER = 'Replying to an earlier message';

/** The quoted message's line: its text (with the media icon), the media's name, or the earlier-message line. */
export function quoteLabel(q: QuotedView): string {
  const media = q.type ? MEDIA[q.type] : undefined;
  const text = q.text?.trim();
  if (media) return text ? `${media[0]} ${text}`.trim() : `${media[0]} ${media[1]}`.trim();
  return text || EARLIER;
}

/** Scrolls to the original message and flashes it, when it is on the page. */
export function openQuoted(messageId: string | null) {
  if (!messageId) return;
  const el = document.getElementById(`message-${messageId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.dataset.flash = 'true';
  const bubble = el.querySelector<HTMLElement>('[data-side]') ?? el;
  bubble.style.outline = '2px solid var(--pf-t--global--color--brand--default)';
  window.setTimeout(() => {
    delete el.dataset.flash;
    bubble.style.outline = '';
  }, 1500);
}

/** The quote inside a reply's bubble, as WhatsApp draws it: bar, sender, bold header, two lines of text. */
export const QuoteBlock: React.FunctionComponent<{ quoted: QuotedView; contactName: string }> = ({
  quoted,
  contactName,
}) => {
  // no name when it cannot be told whose message it was, rather than a wrong one
  const sender = quoted.fromMe === true ? 'You' : quoted.fromMe === false ? contactName : null;
  const label = quoteLabel(quoted);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={sender ? `Quoted message from ${sender}` : 'Quoted message'}
      onClick={() => openQuoted(quoted.messageId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openQuoted(quoted.messageId);
      }}
      style={{
        display: 'flex',
        marginBottom: 6,
        borderRadius: 6,
        overflow: 'hidden',
        cursor: quoted.messageId ? 'pointer' : 'default',
        background: 'var(--pf-t--global--background--color--secondary--hover)',
        whiteSpace: 'normal',
      }}
    >
      <div style={{ width: 4, flexShrink: 0, background: 'var(--pf-t--global--color--brand--default)' }} />
      <div style={{ padding: '4px 8px', minWidth: 0 }}>
        {sender && (
          <div
            style={{
              color: 'var(--pf-t--global--color--brand--default)',
              fontWeight: 'var(--pf-t--global--font--weight--body--bold)',
              fontSize: 'var(--pf-t--global--font--size--sm)',
            }}
          >
            {sender}
          </div>
        )}
        {quoted.title && (
          <div style={{ fontSize: 'var(--pf-t--global--font--size--sm)' }}>
            <strong>{quoted.title}</strong>
          </div>
        )}
        <div
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: 'var(--pf-t--global--font--size--sm)',
            color: 'var(--pf-t--global--text--color--subtle)',
            fontStyle: label === EARLIER ? 'italic' : undefined,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};
