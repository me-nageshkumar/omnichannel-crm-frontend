import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  type Over,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Card, CardBody } from '@patternfly/react-core';
import { KanbanLane, LANE_DROP_PREFIX } from './KanbanLane';
import { type KanbanLaneData, moveCard } from './kanban';

export interface KanbanBoardProps<C> {
  /** A new reference replaces the shown board when no move is pending. */
  lanes: KanbanLaneData<C>[];
  idOf(c: C): string;
  renderCard(c: C): React.ReactNode;
  /** Names a card for its drag handle ("Move {label}"). */
  labelOf?(c: C): string;
  /** Persist a move. {@code beforeId} is the card now above, {@code afterId} the card now below. Reject to roll back. */
  onMove(cardId: string, toLaneKey: string, beforeId: string | null, afterId: string | null): Promise<void>;
  onLoadMore?(laneKey: string): void;
  renderLaneHeaderExtra?(lane: KanbanLaneData<C>): React.ReactNode;
  /** Forces (or forbids) the phone-width lane list; otherwise it follows the viewport. */
  narrow?: boolean;
  ariaLabel: string;
}

const NARROW_QUERY = '(max-width: 767px)';

function useNarrow(forced?: boolean): boolean {
  const query = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(NARROW_QUERY)
      : undefined;
  const [matches, setMatches] = React.useState(() => query()?.matches ?? false);
  React.useEffect(() => {
    const mq = query();
    if (!mq || forced !== undefined) return undefined;
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [forced]);
  return forced ?? matches;
}

interface Placement {
  cardId: string;
  toLaneKey: string;
  /** Position among the lane's other cards. */
  index: number;
}

interface Pending {
  cardId: string;
  toLaneKey: string;
  index: number;
  /** The move was saved; it stays shown until the caller passes new lanes. */
  settled: boolean;
}

/** Lanes of draggable cards. Generic: knows nothing of deals; the caller supplies cards, rendering and persistence. */
export function KanbanBoard<C>({
  lanes,
  idOf,
  renderCard,
  labelOf,
  onMove,
  onLoadMore,
  renderLaneHeaderExtra,
  narrow: narrowProp,
  ariaLabel,
}: KanbanBoardProps<C>) {
  const narrow = useNarrow(narrowProp);
  const [pending, setPending] = React.useState<Pending | null>(null);
  // The card under the pointer while a drag is on; drawn in an overlay so it can cross lanes.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // Where the dragged card would land right now: it is shown there (dimmed) so the target lane opens a gap.
  const [preview, setPreview] = React.useState<Placement | null>(null);
  const [seen, setSeen] = React.useState(lanes);
  // Locked from the start of a move until fresh lanes arrive after it was saved (or it is rolled back).
  const busy = pending !== null;

  // A saved move is shown only until the caller's next lanes arrive; a move in flight survives them.
  if (seen !== lanes) {
    setSeen(lanes);
    if (pending?.settled) setPending(null);
  }
  const settled =
    pending && !(seen !== lanes && pending.settled)
      ? moveCard(lanes, pending.cardId, pending.toLaneKey, pending.index, idOf).lanes
      : lanes;
  const shown = preview ? moveCard(settled, preview.cardId, preview.toLaneKey, preview.index, idOf).lanes : settled;

  /** Whether {@code cardId} already sits at {@code index} of lane {@code toLaneKey} in {@code board}. */
  const sitsAt = (board: KanbanLaneData<C>[], cardId: string, toLaneKey: string, index: number) => {
    const lane = board.find((l) => l.key === toLaneKey);
    const at = lane?.cards.findIndex((c) => idOf(c) === cardId) ?? -1;
    return at >= 0 && at === Math.min(index, lane!.cards.length - 1);
  };

  const move = (cardId: string, toLaneKey: string, index: number) => {
    if (busy) return;
    const r = moveCard(settled, cardId, toLaneKey, index, idOf);
    if (r.lanes === settled || sitsAt(settled, cardId, toLaneKey, index)) return;
    const mine: Pending = { cardId, toLaneKey, index, settled: false };
    setPending(mine);
    onMove(cardId, toLaneKey, r.beforeId, r.afterId).then(
      () => setPending((p) => (p === mine ? { ...mine, settled: true } : p)),
      () => setPending((p) => (p === mine ? null : p)),
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** The lane and position the dragged card would take from what it is over, on the board as shown. */
  const placementOf = (active: DragOverEvent['active'], over: Over): Placement | null => {
    const cardId = String(active.id);
    const overId = String(over.id);
    if (overId === cardId) return null;
    if (overId.startsWith(LANE_DROP_PREFIX)) {
      const key = overId.slice(LANE_DROP_PREFIX.length);
      const lane = shown.find((l) => l.key === key);
      return lane ? { cardId, toLaneKey: key, index: lane.cards.filter((c) => idOf(c) !== cardId).length } : null;
    }
    const to = shown.find((l) => l.cards.some((c) => idOf(c) === overId));
    const from = shown.find((l) => l.cards.some((c) => idOf(c) === cardId));
    if (!to || !from) return null;
    const overIndex = to.cards.findIndex((c) => idOf(c) === overId);
    if (to.key === from.key) return { cardId, toLaneKey: to.key, index: overIndex };
    // Into another lane: below the card hovered when the dragged card sits in its lower half.
    const moved = active.rect.current.translated;
    const below = moved ? moved.top + moved.height / 2 > over.rect.top + over.rect.height / 2 : false;
    return { cardId, toLaneKey: to.key, index: overIndex + (below ? 1 : 0) };
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (busy || !over) return;
    const next = placementOf(active, over);
    if (next && !sitsAt(shown, next.cardId, next.toLaneKey, next.index)) setPreview(next);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setPreview(null);
    if (busy) return;
    const target = preview ?? (over ? placementOf(active, over) : null);
    if (target) move(target.cardId, target.toLaneKey, target.index);
  };
  const onDragCancel = () => {
    setActiveId(null);
    setPreview(null);
  };

  const laneOptions = shown.map((l) => ({ key: l.key, title: l.title }));
  const label = labelOf ?? ((c: C) => 'card ' + idOf(c));

  // Screen readers hear card and lane names, never ids.
  const cardName = (id: string | number): string => {
    for (const l of shown) {
      const c = l.cards.find((x) => idOf(x) === String(id));
      if (c) return label(c);
    }
    return 'card';
  };
  const targetName = (id: string | number | undefined): string => {
    if (id === undefined) return 'no lane';
    const s = String(id);
    if (s.startsWith(LANE_DROP_PREFIX)) {
      const lane = shown.find((l) => l.key === s.slice(LANE_DROP_PREFIX.length));
      return lane ? `lane ${lane.title}` : 'a lane';
    }
    const lane = shown.find((l) => l.cards.some((c) => idOf(c) === s));
    return lane ? `${cardName(s)} in lane ${lane.title}` : 'a lane';
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${cardName(active.id)}.`,
    onDragOver: ({ active, over }) => `${cardName(active.id)} is over ${targetName(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over ? `${cardName(active.id)} was dropped on ${targetName(over.id)}.` : `${cardName(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${cardName(active.id)} was cancelled.`,
  };

  const activeCard = activeId === null ? undefined : shown.flatMap((l) => l.cards).find((c) => idOf(c) === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ announcements }}
    >
      <div
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'flex-start',
          gap: 'var(--pf-t--global--spacer--md)',
          overflowX: narrow ? 'visible' : 'auto',
          paddingBlockEnd: 'var(--pf-t--global--spacer--sm)',
        }}
      >
        {shown.map((lane, i) => (
          <KanbanLane<C>
            key={lane.key}
            lane={lane}
            index={i}
            idOf={idOf}
            labelOf={label}
            renderCard={renderCard}
            headerExtra={renderLaneHeaderExtra?.(lane)}
            narrow={narrow}
            locked={busy}
            laneOptions={laneOptions}
            onMoveTo={(cardId, key) => move(cardId, key, Number.MAX_SAFE_INTEGER)}
            onLoadMore={onLoadMore}
          />
        ))}
      </div>
      {createPortal(
        // On the body: an ancestor with a filter or transform (PatternFly's glass theme blurs the page container)
        // would otherwise become the containing block of the fixed overlay and offset it from the pointer.
        <DragOverlay dropAnimation={null}>
          {activeCard && (
            // a picture of the card under the pointer: the real one stays in its lane with its buttons
            <Card
              aria-hidden
              isCompact
              style={{ cursor: 'grabbing', boxShadow: 'var(--pf-t--global--box-shadow--lg)' }}
            >
              <CardBody>{renderCard(activeCard)}</CardBody>
            </Card>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
