import * as React from 'react';
import { Button, Content, Icon, Title } from '@patternfly/react-core';

export interface TimelineItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  body?: string;
  /** ISO time. */
  at: string;
  by?: string;
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
};
const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { timeStyle: 'short' });
};

/** Items (newest first, as given) grouped by day. */
export const Timeline: React.FunctionComponent<{
  items: TimelineItem[];
  hasMore: boolean;
  onLoadMore?(): void;
  loadingMore?: boolean;
  emptyText?: string;
}> = ({ items, hasMore, onLoadMore, loadingMore, emptyText = 'Nothing here yet.' }) => {
  const groups: { key: string; label: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const key = dayKey(item.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.at), items: [item] });
  }
  return (
    <div>
      {items.length === 0 && <Content component="p">{emptyText}</Content>}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label} className="pf-v6-u-mb-md">
          <Title headingLevel="h3" size="md" className="pf-v6-u-mb-sm">
            {g.label}
          </Title>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {g.items.map((i) => (
              <li
                key={i.id}
                style={{
                  display: 'flex',
                  gap: 'var(--pf-t--global--spacer--sm)',
                  paddingBlock: 'var(--pf-t--global--spacer--xs)',
                }}
              >
                <Icon>{i.icon}</Icon>
                <div>
                  <div data-testid="timeline-title">
                    <strong>{i.title}</strong>
                  </div>
                  {i.body && <div style={{ whiteSpace: 'pre-wrap' }}>{i.body}</div>}
                  <Content component="small" style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
                    {timeLabel(i.at)}
                    {i.by ? ` · ${i.by}` : ''}
                  </Content>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hasMore && onLoadMore && (
        <Button variant="link" onClick={onLoadMore} isLoading={loadingMore} isDisabled={loadingMore}>
          Load more
        </Button>
      )}
    </div>
  );
};
