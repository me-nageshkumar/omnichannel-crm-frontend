import * as React from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanLane, LANE_DROP_PREFIX } from './KanbanLane';
import { type KanbanLaneData, moveCard } from './kanban';

export interface KanbanBoardProps<C> {
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

interface Pending {
  cardId: string;
  toLaneKey: string;
  index: number;
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
  const [shown, setShown] = React.useState(lanes);
  const pending = React.useRef<Pending | null>(null);
  const latest = React.useRef(lanes);
  const idRef = React.useRef(idOf);
  idRef.current = idOf;

  // A new lanes prop wins, except that a move still in flight keeps its card where it was dropped.
  React.useEffect(() => {
    latest.current = lanes;
    const p = pending.current;
    setShown(p ? moveCard(lanes, p.cardId, p.toLaneKey, p.index, idRef.current).lanes : lanes);
  }, [lanes]);

  const move = (cardId: string, toLaneKey: string, index: number) => {
    const r = moveCard(shown, cardId, toLaneKey, index, idOf);
    if (r.lanes === shown) return;
    const mine: Pending = { cardId, toLaneKey, index };
    pending.current = mine;
    setShown(r.lanes);
    onMove(cardId, toLaneKey, r.beforeId, r.afterId).then(
      () => {
        if (pending.current === mine) pending.current = null;
      },
      () => {
        if (pending.current === mine) {
          pending.current = null;
          setShown(latest.current);
        }
      },
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (overId.startsWith(LANE_DROP_PREFIX)) {
      const key = overId.slice(LANE_DROP_PREFIX.length);
      const lane = shown.find((l) => l.key === key);
      if (lane) move(activeId, key, lane.cards.filter((c) => idOf(c) !== activeId).length);
      return;
    }
    const to = shown.find((l) => l.cards.some((c) => idOf(c) === overId));
    const from = shown.find((l) => l.cards.some((c) => idOf(c) === activeId));
    if (!to || !from) return;
    const overIndex = to.cards.findIndex((c) => idOf(c) === overId);
    if (to.key === from.key) {
      move(activeId, to.key, overIndex);
      return;
    }
    // Into another lane: below the card dropped on when the dragged card sits in its lower half.
    const moved = active.rect.current.translated;
    const below = moved ? moved.top + moved.height / 2 > over.rect.top + over.rect.height / 2 : false;
    move(activeId, to.key, overIndex + (below ? 1 : 0));
  };

  const laneOptions = shown.map((l) => ({ key: l.key, title: l.title }));
  const label = labelOf ?? ((c: C) => 'card ' + idOf(c));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
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
            laneOptions={laneOptions}
            onMoveTo={(cardId, key) => move(cardId, key, Number.MAX_SAFE_INTEGER)}
            onLoadMore={onLoadMore}
          />
        ))}
      </div>
    </DndContext>
  );
}
