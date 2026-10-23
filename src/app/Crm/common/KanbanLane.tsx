import * as React from 'react';
import { Badge, Button, Title } from '@patternfly/react-core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { KanbanLaneData } from './kanban';

export const LANE_DROP_PREFIX = 'lane:';

interface Props<C> {
  lane: KanbanLaneData<C>;
  index: number;
  idOf(c: C): string;
  labelOf(c: C): string;
  renderCard(c: C): React.ReactNode;
  headerExtra?: React.ReactNode;
  narrow?: boolean;
  /** A move is being saved: no other card can be moved. */
  locked?: boolean;
  laneOptions?: { key: string; title: string }[];
  onMoveTo?(cardId: string, laneKey: string): void;
  onLoadMore?(laneKey: string): void;
}

/** One 280px lane: header with the total, its sortable cards, and a Load more button while more remain. */
export function KanbanLane<C>({
  lane,
  index,
  idOf,
  labelOf,
  renderCard,
  headerExtra,
  narrow,
  locked,
  laneOptions,
  onMoveTo,
  onLoadMore,
}: Props<C>) {
  const { setNodeRef } = useDroppable({ id: LANE_DROP_PREFIX + lane.key, disabled: narrow });
  const ids = lane.cards.map(idOf);
  return (
    <section
      aria-label={lane.title}
      ref={setNodeRef}
      data-lane-index={index}
      style={{
        flex: narrow ? '0 0 auto' : '0 0 280px',
        width: narrow ? '100%' : 280,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pf-t--global--spacer--sm)',
        padding: 'var(--pf-t--global--spacer--sm)',
        background: 'var(--pf-t--global--background--color--secondary--default)',
        border: 'var(--pf-t--global--border--width--regular) solid var(--pf-t--global--border--color--default)',
        borderTop: `var(--pf-t--global--border--width--extra-strong) solid ${lane.color ?? 'var(--pf-t--global--border--color--default)'}`,
        borderRadius: 'var(--pf-t--global--border--radius--medium)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--sm)' }}>
        <Title headingLevel="h3" size="md" style={{ flex: '1 1 auto' }}>
          {lane.title}
        </Title>
        {lane.badge}
        <Badge isRead>{lane.total}</Badge>
        {headerExtra}
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--pf-t--global--spacer--sm)',
            minHeight: 'var(--pf-t--global--spacer--2xl)',
          }}
        >
          {lane.cards.map((c, i) => (
            <KanbanCard
              key={idOf(c)}
              id={idOf(c)}
              laneIndex={index}
              index={i}
              label={labelOf(c)}
              narrow={narrow}
              locked={locked}
              laneOptions={laneOptions?.filter((o) => o.key !== lane.key)}
              onMoveTo={(k) => onMoveTo?.(idOf(c), k)}
            >
              {renderCard(c)}
            </KanbanCard>
          ))}
        </div>
      </SortableContext>
      {onLoadMore && lane.cards.length < lane.total && (
        <Button variant="link" isInline onClick={() => onLoadMore(lane.key)} aria-label={`Load more in ${lane.title}`}>
          Load more
        </Button>
      )}
      {lane.footer}
    </section>
  );
}
