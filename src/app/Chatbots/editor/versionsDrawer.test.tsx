import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionsDrawer } from '@app/Chatbots/editor/VersionsDrawer';
import { SessionProvider } from '@app/session/SessionContext';
import type { MockRoute } from '../../../test/fetchMock';
import { callsTo, mockFetch } from '../../../test/fetchMock';
import { CHATBOTS_BASE, LEAD_QUALIFIER, PUBLISHED_BOT, VERSIONS } from '../../../test/chatbots';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';

const V = `${CHATBOTS_BASE}/c1/versions`;
const OLD_FLOW = { ...LEAD_QUALIFIER.flow, nodes: LEAD_QUALIFIER.flow.nodes.slice(0, 1), edges: [] };

function open(
  props: Partial<React.ComponentProps<typeof VersionsDrawer>> = {},
  routes: Record<string, MockRoute> = {},
) {
  const f = mockFetch({
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${V}`]: { status: 200, body: VERSIONS },
    [`GET ${V}/1`]: { status: 200, body: OLD_FLOW },
    [`POST ${V}/1/restore`]: {
      status: 200,
      body: { chatbot: { ...LEAD_QUALIFIER, flow: OLD_FLOW, version: 4 }, problems: [] },
    },
    ...routes,
  });
  const onPreview = vi.fn();
  const onRestored = vi.fn();
  render(
    <SessionProvider>
      <VersionsDrawer
        chatbot={LEAD_QUALIFIER}
        readOnly={false}
        onPreview={onPreview}
        onRestored={onRestored}
        onClose={() => undefined}
        {...props}
      />
    </SessionProvider>,
  );
  return { f, onPreview, onRestored, user: userEvent.setup() };
}

describe('VersionsDrawer', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.restoreAllMocks());

  it('listsVersions', async () => {
    open();
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Version 2');
    expect(items[0]).toHaveTextContent('Demo Manager');
    expect(items[0]).toHaveTextContent('current');
  });

  it('previewThenExit', async () => {
    const { onPreview, user } = open();
    const items = await screen.findAllByRole('listitem');
    await user.click(within(items[1]).getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(OLD_FLOW));
    expect(screen.getByText('Previewing version 1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Exit preview' }));
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('restoreConfirmsAndCalls', async () => {
    const { f, onRestored, user } = open();
    const items = await screen.findAllByRole('listitem');
    await user.click(within(items[1]).getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Restore version 1?')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(callsTo(f, `POST ${V}/1/restore`)).toBe(1);
    expect(onRestored.mock.calls[0][0].chatbot.version).toBe(4);
  });

  it('readOnlyHidesRestore', async () => {
    open(
      { chatbot: PUBLISHED_BOT, readOnly: true },
      { [`GET ${CHATBOTS_BASE}/c2/versions`]: { status: 200, body: VERSIONS } },
    );
    const items = await screen.findAllByRole('listitem');
    expect(within(items[1]).queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(within(items[1]).getByRole('button', { name: 'Preview' })).toBeVisible();
  });
});
