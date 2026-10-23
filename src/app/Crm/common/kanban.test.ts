import { describe, expect, it } from 'vitest';
import { type KanbanLaneData, moveCard } from './kanban';

interface Card {
  id: string;
}
const idOf = (c: Card) => c.id;
const lane = (key: string, ids: string[]): KanbanLaneData<Card> => ({
  key,
  title: key,
  total: ids.length,
  cards: ids.map((id) => ({ id })),
});
const ids = (l: KanbanLaneData<Card>) => l.cards.map(idOf);

describe('moveCard', () => {
  it('moveWithinLaneReturnsNeighbours', () => {
    const r = moveCard([lane('a', ['1', '2', '3', '4'])], '1', 'a', 2, idOf);
    expect(ids(r.lanes[0])).toEqual(['2', '3', '1', '4']);
    expect(r.beforeId).toBe('3');
    expect(r.afterId).toBe('4');
  });

  it('moveToEmptyLaneHasNoNeighbours', () => {
    const r = moveCard([lane('a', ['1', '2']), lane('b', [])], '1', 'b', 0, idOf);
    expect(ids(r.lanes[0])).toEqual(['2']);
    expect(ids(r.lanes[1])).toEqual(['1']);
    expect(r.lanes.map((l) => l.total)).toEqual([1, 1]);
    expect(r.beforeId).toBeNull();
    expect(r.afterId).toBeNull();
  });

  it('moveToTopHasOnlyAfter', () => {
    const r = moveCard([lane('a', ['1']), lane('b', ['5', '6'])], '1', 'b', 0, idOf);
    expect(r.beforeId).toBeNull();
    expect(r.afterId).toBe('5');
  });

  it('moveToBottomHasOnlyBefore', () => {
    const r = moveCard([lane('a', ['1']), lane('b', ['5', '6'])], '1', 'b', 99, idOf);
    expect(ids(r.lanes[1])).toEqual(['5', '6', '1']);
    expect(r.beforeId).toBe('6');
    expect(r.afterId).toBeNull();
  });

  it('doesNotMutateInput', () => {
    const lanes = [lane('a', ['1', '2'])];
    moveCard(lanes, '1', 'a', 1, idOf);
    expect(ids(lanes[0])).toEqual(['1', '2']);
  });
});
