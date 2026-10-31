import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

describe('masthead', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('centresTheRightHandItemsVertically', async () => {
    mockFetch(meAs(WORKSPACE_MANAGER));
    renderApp('/');
    const brand = await screen.findByText('Brand: Brand A');
    // An item stretched to the toolbar's height puts a plain label at the top and a switch's toggle above the
    // middle; each item centres its content instead (the group modifier alone leaves the items stretched).
    const group = brand.closest('.pf-v6-c-toolbar__group') as HTMLElement;
    const items = Array.from(group.querySelectorAll('.pf-v6-c-toolbar__item'));
    expect(items.length).toBeGreaterThanOrEqual(3);
    items.forEach((item) => expect(item).toHaveClass('pf-m-align-items-center'));
  });
});
