import type * as React from 'react';

export interface KanbanLaneData<C> {
  key: string;
  title: string;
  color?: string;
  total: number;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
  cards: C[];
}

export interface MoveResult<C> {
  lanes: KanbanLaneData<C>[];
  /** The card directly above the moved card, or null at the top of the lane. */
  beforeId: string | null;
  /** The card directly below the moved card, or null at the bottom of the lane. */
  afterId: string | null;
}

/**
 * Moves a card to {@code index} of the target lane, counted after the card has been taken out of its old place
 * (so within a lane it is the card's final position). Pure: returns new lanes and the neighbours at the drop.
 * An unknown card or lane leaves the lanes as they were.
 */
export function moveCard<C>(
  lanes: KanbanLaneData<C>[],
  cardId: string,
  toLaneKey: string,
  index: number,
  idOf: (c: C) => string,
): MoveResult<C> {
  const from = lanes.find((l) => l.cards.some((c) => idOf(c) === cardId));
  const to = lanes.find((l) => l.key === toLaneKey);
  const card = from?.cards.find((c) => idOf(c) === cardId);
  if (!from || !to || card === undefined) return { lanes, beforeId: null, afterId: null };

  const target = to.cards.filter((c) => idOf(c) !== cardId);
  const at = Math.max(0, Math.min(index, target.length));
  const next = [...target.slice(0, at), card, ...target.slice(at)];
  const before = next[at - 1];
  const after = next[at + 1];
  return {
    lanes: lanes.map((l) => {
      if (l.key === to.key) return { ...l, cards: next, total: l === from ? l.total : l.total + 1 };
      if (l.key === from.key) return { ...l, cards: l.cards.filter((c) => idOf(c) !== cardId), total: l.total - 1 };
      return l;
    }),
    beforeId: before === undefined ? null : idOf(before),
    afterId: after === undefined ? null : idOf(after),
  };
}
