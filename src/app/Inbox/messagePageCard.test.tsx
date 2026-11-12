import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MessagePageView, MessageView } from '@app/api/inbox';
import { MessageBubble } from '@app/Inbox/MessageBubble';
import { MessagePageCard } from '@app/Inbox/MessagePageCard';

const future = new Date(Date.now() + 86400_000).toISOString();

function page(over: Partial<MessagePageView> = {}): MessagePageView {
  return {
    url: 'http://pages.test/t/abc',
    expiresAt: future,
    openedAt: null,
    openCount: 0,
    buttons: [],
    rows: [],
    cta: null,
    location: null,
    ...over,
  };
}

const SENT: MessageView = {
  id: 'm1',
  chatId: 'c1',
  waMessageId: 'wa-m1',
  direction: 'OUT',
  source: 'CONSOLE',
  type: 'text',
  body: 'http://pages.test/t/abc',
  media: null,
  location: null,
  timestamp: '2026-10-21T10:00:00Z',
  status: 'SENT',
  statusTimes: { sentAt: null, deliveredAt: null, readAt: null, playedAt: null, failedAt: null },
  sentBy: null,
  templateId: null,
  adClick: null,
  messagePageId: 'p1',
  messagePage: null,
};

describe('message page card', () => {
  it('shows opened count and per-button counts with replied ticks', () => {
    render(
      <MessagePageCard
        page={page({
          openedAt: '2026-10-21T10:05:00Z',
          openCount: 3,
          buttons: [
            { id: 'change', title: 'Change', count: 2, replied: true },
            { id: 'cancel', title: 'Cancel', count: 0, replied: false },
          ],
        })}
      />,
    );
    expect(screen.getByText('Opened · 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Change: replied')).toHaveTextContent('Change · 2');
    expect(screen.getByText('Cancel · 0')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cancel: replied')).not.toBeInTheDocument();
  });

  it('shows not opened and the page link', () => {
    render(<MessagePageCard page={page()} />);
    expect(screen.getByText('Not opened')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open page' });
    expect(link).toHaveAttribute('href', 'http://pages.test/t/abc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('expiredPageShowsExpired', () => {
    render(
      <MessagePageCard
        page={page({ expiresAt: '2020-01-01T00:00:00Z', openCount: 4, openedAt: '2020-01-01T00:00:00Z' })}
      />,
    );
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Opened · 4')).toBeInTheDocument();
  });

  it('shows rows, the link count and the shared location as a map link', () => {
    render(
      <MessagePageCard
        page={page({
          rows: [{ id: 'r1', title: 'Overnight', count: 1, replied: false }],
          cta: { id: 'cta', title: 'See Dates', count: 2, replied: false },
          location: { latitude: 12.9, longitude: 77.6, at: '2026-10-21T10:06:00Z' },
        })}
      />,
    );
    expect(screen.getByText('Overnight · 1')).toBeInTheDocument();
    expect(screen.getByText('Link opened · 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shared location' })).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=12.9,77.6',
    );
  });

  it('MessageBubble renders the card for a message with messagePage', () => {
    render(
      <MessageBubble
        message={{ ...SENT, messagePage: page({ openCount: 1, openedAt: '2026-10-21T10:05:00Z' }) }}
        side="right"
        contact="Asha"
      />,
    );
    expect(screen.getByText('Interactive message')).toBeInTheDocument();
    expect(screen.getByText('Opened · 1')).toBeInTheDocument();
    expect(screen.getByText('http://pages.test/t/abc')).toBeInTheDocument();
  });

  it('MessageBubble shows nothing extra without a page', () => {
    render(<MessageBubble message={SENT} side="right" contact="Asha" />);
    expect(screen.queryByText('Interactive message')).not.toBeInTheDocument();
  });
});
