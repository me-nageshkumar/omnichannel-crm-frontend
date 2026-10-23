import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KanbanBoard } from './KanbanBoard';
import type { KanbanLaneData } from './kanban';

interface Card {
  id: string;
  name: string;
}
const card = (id: string): Card => ({ id, name: `Card ${id}` });
const lanes = (): KanbanLaneData<Card>[] => [
  { key: 'new', title: 'New', total: 2, cards: [card('1'), card('2')] },
  { key: 'won', title: 'Won', total: 1, cards: [card('3')] },
  { key: 'lost', title: 'Lost', total: 0, cards: [] },
];

type Props = Partial<React.ComponentProps<typeof KanbanBoard<Card>>>;
const board = (props: Props = {}) => (
  <KanbanBoard<Card>
    lanes={lanes()}
    idOf={(c) => c.id}
    labelOf={(c) => c.name}
    renderCard={(c) => <span>{c.name}</span>}
    onMove={() => Promise.resolve()}
    ariaLabel="Deals board"
    {...props}
  />
);
const names = (lane: string) =>
  within(screen.getByRole('region', { name: lane }))
    .queryAllByText(/^Card /)
    .map((e) => e.textContent);

describe('KanbanBoard', () => {
  beforeEach(() => {
    // jsdom has no layout: lanes sit side by side, cards stack within their lane.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const el = this as HTMLElement;
      const lane = Number(el.dataset?.laneIndex ?? NaN);
      const cardIdx = Number(el.dataset?.cardIndex ?? NaN);
      const laneOf = Number(el.dataset?.cardLane ?? NaN);
      let left = 0;
      let top = 0;
      let width = 0;
      let height = 0;
      if (!Number.isNaN(lane)) {
        left = lane * 300;
        width = 280;
        height = 600;
      } else if (!Number.isNaN(cardIdx)) {
        left = laneOf * 300;
        top = 40 + cardIdx * 100;
        width = 280;
        height = 90;
      }
      return { top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON: () => ({}) };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function keyboardMove(user: ReturnType<typeof userEvent.setup>, label: string, keys: string[]) {
    screen.getByRole('button', { name: label }).focus();
    await user.keyboard(' ');
    for (const k of keys) await user.keyboard(k);
    await user.keyboard(' ');
  }

  it('rendersLanesWithTotals', () => {
    render(board());
    expect(screen.getByRole('region', { name: 'Deals board' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'New' })).getByText('2')).toBeInTheDocument();
    expect(names('New')).toEqual(['Card 1', 'Card 2']);
    expect(names('Lost')).toEqual([]);
  });

  it('keyboardMoveCallsOnMoveWithNeighbours', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(board({ onMove }));
    await keyboardMove(user, 'Move Card 1', ['{ArrowDown}']);
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove).toHaveBeenCalledWith('1', 'new', '2', null);
    expect(names('New')).toEqual(['Card 2', 'Card 1']);
  });

  it('keyboardMoveToEmptyLaneHasNoNeighbours', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(board({ onMove }));
    await keyboardMove(user, 'Move Card 3', ['{ArrowRight}']);
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('3', 'lost', null, null));
  });

  it('failedMoveRollsBack', async () => {
    const onMove = vi.fn().mockRejectedValue(new Error('no'));
    const user = userEvent.setup();
    render(board({ onMove }));
    await keyboardMove(user, 'Move Card 1', ['{ArrowDown}']);
    await waitFor(() => expect(onMove).toHaveBeenCalled());
    await waitFor(() => expect(names('New')).toEqual(['Card 1', 'Card 2']));
  });

  it('pendingMoveSurvivesPropRefresh', async () => {
    let resolve: () => void = () => {};
    const onMove = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    const user = userEvent.setup();
    const { rerender } = render(board({ onMove }));
    await keyboardMove(user, 'Move Card 1', ['{ArrowDown}']);
    await waitFor(() => expect(names('New')).toEqual(['Card 2', 'Card 1']));
    rerender(board({ onMove, lanes: lanes() })); // a refresh arrives with the old order
    expect(names('New')).toEqual(['Card 2', 'Card 1']);
    await act(async () => resolve());
    rerender(board({ onMove, lanes: [{ ...lanes()[0], cards: [card('2'), card('1')] }, ...lanes().slice(1)] }));
    expect(names('New')).toEqual(['Card 2', 'Card 1']);
    rerender(board({ onMove, lanes: lanes() })); // after it resolves the next props win
    expect(names('New')).toEqual(['Card 1', 'Card 2']);
  });

  it('secondMoveIsBlockedWhilePending', async () => {
    const onMove = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const user = userEvent.setup();
    render(board({ onMove }));
    await keyboardMove(user, 'Move Card 1', ['{ArrowDown}']);
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Move Card 3' })).toBeDisabled();
    await keyboardMove(user, 'Move Card 3', ['{ArrowRight}']);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(names('Won')).toEqual(['Card 3']);
  });

  it('moveAfterSuccessWaitsForFreshLanes', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = render(board({ onMove }));
    await keyboardMove(user, 'Move Card 1', ['{ArrowDown}']);
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Card 3' })).toBeDisabled());
    await keyboardMove(user, 'Move Card 3', ['{ArrowRight}']);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(names('New')).toEqual(['Card 2', 'Card 1']);
    const fresh = [{ ...lanes()[0], cards: [card('2'), card('1')] }, ...lanes().slice(1)];
    rerender(board({ onMove, lanes: fresh }));
    expect(screen.getByRole('button', { name: 'Move Card 3' })).toBeEnabled();
    await keyboardMove(user, 'Move Card 3', ['{ArrowRight}']);
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('3', 'lost', null, null));
  });

  it('rollbackAfterRefreshShowsLatestLanes', async () => {
    let reject: (e: Error) => void = () => {};
    const onMove = vi.fn().mockReturnValue(new Promise<void>((_r, j) => (reject = j)));
    const user = userEvent.setup();
    const { rerender } = render(board({ onMove }));
    await keyboardMove(user, 'Move Card 1', ['{ArrowDown}']);
    await waitFor(() => expect(names('New')).toEqual(['Card 2', 'Card 1']));
    const fresh = [{ ...lanes()[0], cards: [card('1'), card('2'), card('9')], total: 3 }, ...lanes().slice(1)];
    rerender(board({ onMove, lanes: fresh }));
    expect(names('New')).toEqual(['Card 2', 'Card 1', 'Card 9']);
    await act(async () => reject(new Error('no')));
    expect(names('New')).toEqual(['Card 1', 'Card 2', 'Card 9']);
  });

  it('loadMoreShownWhenTotalExceedsCards', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    const l = lanes();
    l[0].total = 5;
    render(board({ lanes: l, onLoadMore }));
    expect(screen.getAllByRole('button', { name: /Load more/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Load more in New' }));
    expect(onLoadMore).toHaveBeenCalledWith('new');
  });

  it('narrowViewportRendersLaneList', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(board({ narrow: true, onMove }));
    expect(screen.queryByRole('button', { name: 'Move Card 1' })).toBeNull();
    const select = within(screen.getByRole('region', { name: 'New' })).getAllByLabelText(/^Move .* to…$/)[0];
    await user.selectOptions(select, 'Won');
    expect(onMove).toHaveBeenCalledWith('1', 'won', '3', null);
    expect(names('Won')).toEqual(['Card 3', 'Card 1']);
  });

  it('usesMatchMediaWhenNarrowIsNotGiven', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(max-width: 767px)',
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(board());
    expect(screen.queryByRole('button', { name: 'Move Card 1' })).toBeNull();
    expect(screen.getAllByLabelText(/^Move .* to…$/).length).toBe(3);
  });

  it('announcesMovesWithCardAndLaneNamesNotIds', async () => {
    const user = userEvent.setup();
    render(board());
    await keyboardMove(user, 'Move Card 1', ['{ArrowRight}']);
    const live = Array.from(document.querySelectorAll('[id^="DndLiveRegion"]')).map((e) => e.textContent).join(' ');
    expect(live).toContain('Card 1');
    expect(live).toMatch(/lane (Won|New)/);
    expect(live).not.toMatch(/Draggable item|droppable|item [123]\b/);
  });

  it('narrowSelectNamesItsCard', () => {
    render(board({ narrow: true }));
    expect(screen.getByLabelText('Move Card 2 to…')).toBeInTheDocument();
  });
});
