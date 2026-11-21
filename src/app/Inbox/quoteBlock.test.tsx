import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MessageView, QuotedView } from '@app/api/inbox';
import { MessageBubble } from '@app/Inbox/MessageBubble';
import { QuoteBlock, quoteLabel } from '@app/Inbox/QuoteBlock';
import { SessionProvider } from '@app/session/SessionContext';

const OK: MessageView = {
  id: 'm2',
  chatId: 'c1',
  waMessageId: 'wamid.OK',
  direction: 'IN',
  source: 'CONTACT',
  type: 'text',
  body: 'Ok',
  media: null,
  location: null,
  timestamp: '2026-11-21T02:44:26Z',
  status: 'PENDING',
  statusTimes: { sentAt: null, deliveredAt: null, readAt: null, playedAt: null, failedAt: null },
  sentBy: null,
  templateId: null,
  messagePageId: null,
  messagePage: null,
  adClick: null,
};

const HELLO: QuotedView = {
  messageId: 'm1',
  fromMe: true,
  from: '15551833836',
  title: 'Hello World',
  text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.',
  type: 'template',
};

describe('reply quotes', () => {
  it('quoteShowsSenderHeaderAndText', () => {
    render(<MessageBubble side="left" contact="Nagesh Kumar" message={{ ...OK, quoted: HELLO }} />);
    const quote = screen.getByRole('button', { name: /Quoted message/ });
    expect(quote).toHaveTextContent('You');
    expect(screen.getByText('Hello World').tagName).toBe('STRONG');
    expect(screen.getByText(/^Welcome and congratulations/)).toHaveStyle({ WebkitLineClamp: '2' });
    expect(screen.getByText('Ok')).toBeVisible();
  });

  it('contactQuoteShowsTheirName', () => {
    render(
      <QuoteBlock
        quoted={{ ...HELLO, fromMe: false, title: null, text: 'Is the bus at 8?' }}
        contactName="Nagesh Kumar"
      />,
    );
    expect(screen.getByText('Nagesh Kumar')).toBeVisible();
  });

  it('mediaQuoteShowsItsLabel', () => {
    expect(quoteLabel({ ...HELLO, title: null, text: null, type: 'image' })).toBe('📷 Photo');
    expect(quoteLabel({ ...HELLO, title: null, text: null, type: 'document' })).toBe('📄 Document');
    expect(quoteLabel({ ...HELLO, title: null, text: 'Fees', type: 'image' })).toBe('📷 Fees');
  });

  it('missingTextSaysEarlierMessage', () => {
    render(<QuoteBlock quoted={{ ...HELLO, fromMe: false, title: null, text: null, type: null }} contactName="" />);
    expect(screen.getByText('Replying to an earlier message')).toBeVisible();
  });

  it('clickScrollsToTheOriginal', async () => {
    const target = document.createElement('div');
    target.id = 'message-m1';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    render(<QuoteBlock quoted={HELLO} contactName="Nagesh Kumar" />);
    await userEvent.click(screen.getByRole('button', { name: /Quoted message/ }));
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target.dataset.flash).toBe('true');
    target.remove();
    await userEvent.click(screen.getByRole('button', { name: /Quoted message/ }));
  });

  it('forwardedMarked', () => {
    render(<MessageBubble side="left" contact="Nagesh Kumar" message={{ ...OK, forwarded: true }} />);
    const mark = screen.getByText('Forwarded');
    expect(mark.compareDocumentPosition(screen.getByText('Ok')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('quoteOnMediaReply', () => {
    render(
      <SessionProvider>
        <MessageBubble
          side="left"
          contact="Nagesh Kumar"
          message={{
            ...OK,
            type: 'image',
            body: 'Here is the receipt',
            media: { mimetype: 'image/jpeg', filename: null, size: 10, available: false },
            quoted: HELLO,
          }}
        />
      </SessionProvider>,
    );
    const quote = screen.getByRole('button', { name: /Quoted message/ });
    expect(
      quote.compareDocumentPosition(screen.getByText('Here is the receipt')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('noQuoteUnchanged', () => {
    render(<MessageBubble side="left" contact="Nagesh Kumar" message={OK} />);
    expect(screen.queryByRole('button', { name: /Quoted message/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Forwarded')).not.toBeInTheDocument();
    expect(document.getElementById('message-m2')).not.toBeNull();
  });
});
