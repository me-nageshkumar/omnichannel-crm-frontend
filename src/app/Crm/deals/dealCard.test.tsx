import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DealCard } from '@app/Crm/deals/DealCard';
import { sampleDeal } from '../../../test/crm';

function setup(overrides = {}) {
  const onOpen = vi.fn();
  const onOpenChat = vi.fn();
  const onCardPointerDown = vi.fn();
  render(
    // stands in for the board's card, which starts a drag on pointer down
    // eslint-disable-next-line react/no-unknown-property -- the plugin's DOM list predates pointer events
    <div onPointerDown={onCardPointerDown}>
      <DealCard deal={sampleDeal(overrides)} onOpen={onOpen} onOpenChat={onOpenChat} />
    </div>,
  );
  return { onOpen, onOpenChat, onCardPointerDown };
}

describe('Deal card', () => {
  it('chatButtonDoesNotOpenTheDeal', () => {
    const { onOpen, onOpenChat } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open chat with Priya Shah' }));
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('chatButtonDoesNotStartADrag', () => {
    const { onCardPointerDown } = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open chat with Priya Shah' }));
    expect(onCardPointerDown).not.toHaveBeenCalled();
  });

  it('noChatButtonWithoutAPrimaryContact', () => {
    setup({ primaryContact: null });
    expect(screen.queryByRole('button', { name: /Open chat/ })).toBeNull();
  });

  it('closedDealShowsNoDaysInStage', () => {
    setup({ status: 'WON' });
    expect(screen.queryByText(/in stage/)).toBeNull();
  });
});
