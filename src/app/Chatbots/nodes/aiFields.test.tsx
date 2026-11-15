import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ChatbotOptions, Problem, SavedFlow, SavedNode } from '@app/api/chatbots';
import type { CurrentUser } from '@app/api/users';
import { NodeDrawer } from '@app/Chatbots/editor/NodeDrawer';
import '@app/Chatbots/nodes';
import { CATALOG } from '@app/Chatbots/nodeCatalog';
import { SessionProvider } from '@app/session/SessionContext';
import { OPTIONS } from '../../../test/chatbots';
import { callsTo, mockFetch } from '../../../test/fetchMock';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { AI_BASE, PROFILE, PROVIDERS } from '../../../test/ai';

const EDITOR_ONLY: CurrentUser = {
  ...WORKSPACE_MANAGER,
  workspaces: [{ ...BRAND_A, authorities: ['chatbot:view', 'chatbot:manage'] }],
};

function aiNode(settings: Record<string, unknown> = {}, id = 'ai1', name = 'Sales'): SavedNode {
  return {
    id,
    type: 'ai',
    position: { x: 0, y: 0 },
    data: { name, settings: { ...CATALOG.ai.defaultSettings(), profileId: 'p1', ...settings } },
  };
}

const Harness: React.FunctionComponent<{
  node: SavedNode;
  flow: SavedFlow;
  options: ChatbotOptions;
  problems: Problem[];
  onChange(s: Record<string, unknown>): void;
}> = ({ node: initial, flow, options, problems, onChange }) => {
  const [n, setN] = React.useState(initial);
  return (
    <MemoryRouter>
      <SessionProvider>
        <NodeDrawer
          node={n}
          flow={{ ...flow, nodes: flow.nodes.map((x) => (x.id === n.id ? n : x)) }}
          chatbotId="c1"
          options={options}
          problems={problems}
          readOnly={false}
          onChange={(settings) => {
            onChange(settings);
            setN((cur) => ({ ...cur, data: { ...cur.data, settings } }));
          }}
          onClose={() => undefined}
        />
      </SessionProvider>
    </MemoryRouter>
  );
};

async function open(
  n: SavedNode,
  {
    user = WORKSPACE_MANAGER,
    options = OPTIONS,
    flow,
    problems = [],
    profile = PROFILE,
  }: { user?: CurrentUser; options?: ChatbotOptions; flow?: SavedFlow; problems?: Problem[]; profile?: unknown } = {},
) {
  cleanup();
  const fetch = mockFetch({
    ...meAs(user),
    [`GET ${AI_BASE}/providers`]: { status: 200, body: PROVIDERS },
    [`GET ${AI_BASE}/profiles/p1`]: { status: 200, body: profile },
  });
  const onChange = vi.fn();
  render(
    <Harness
      node={n}
      flow={flow ?? { nodes: [n], edges: [] }}
      options={options}
      problems={problems}
      onChange={onChange}
    />,
  );
  await screen.findByLabelText('AI profile');
  return { onChange, fetch, user: userEvent.setup() };
}

const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0] as Record<string, unknown>;

describe('AI node fields', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('profileFromOptions', async () => {
    const { onChange, user } = await open(aiNode({ profileId: '' }));
    const select = screen.getByLabelText('AI profile');
    expect(within(select).getByRole('option', { name: 'Sales assistant' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Classifier' })).toBeInTheDocument();
    await user.selectOptions(select, 'p2');
    expect(last(onChange)).toMatchObject({ profileId: 'p2' });
  });

  it('noProfilesLinksOnlyWithAiView', async () => {
    await open(aiNode({ profileId: '' }), { options: { ...OPTIONS, aiProfiles: [] } });
    expect(await screen.findByText(/No AI profiles yet/)).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Set one up on the AI page' })).toHaveAttribute(
      'href',
      '/ai?tab=profiles',
    );
    await open(aiNode({ profileId: '' }), { options: { ...OPTIONS, aiProfiles: [] }, user: EDITOR_ONLY });
    await waitFor(() => expect(screen.getByText(/No AI profiles yet/)).toBeVisible());
    expect(screen.queryByRole('link', { name: 'Set one up on the AI page' })).toBeNull();
  });

  it('editorWithoutAiViewSeesProfileName', async () => {
    const { fetch } = await open(aiNode(), { user: EDITOR_ONLY });
    expect((screen.getByLabelText('AI profile') as HTMLSelectElement).selectedOptions[0].textContent).toBe(
      'Sales assistant',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(callsTo(fetch, `GET ${AI_BASE}/profiles/p1`)).toBe(0);
  });

  it('modeTogglesSections', async () => {
    const { onChange, user } = await open(aiNode({ mode: 'CONVERSATION' }));
    expect(screen.getByLabelText(/^Initial message/)).toBeVisible();
    expect(screen.getByLabelText(/^Max turns/)).toBeVisible();
    expect(screen.queryByLabelText('Send the reply to the customer')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'One call' }));
    expect(last(onChange)).toMatchObject({ mode: 'SINGLE' });
    expect(screen.queryByLabelText(/^Initial message/)).toBeNull();
    expect(screen.queryByLabelText(/^Max turns/)).toBeNull();
    expect(screen.getByLabelText('Send the reply to the customer')).toBeVisible();
  });

  it('outcomeLabelSlugsId', async () => {
    const { onChange, user } = await open(aiNode());
    await user.click(screen.getByRole('button', { name: 'Add outcome' }));
    await user.type(screen.getByLabelText('Outcome 1 label'), 'Not interested');
    expect((last(onChange).outcomes as { id: string }[])[0].id).toBe('not_interested');
    expect(CATALOG.ai.outputs(last(onChange)).map((o) => o.id)).toContain('outcome:not_interested');
  });

  it('labelChangeKeepsEdge', async () => {
    const { onChange, user } = await open(aiNode({ outcomes: [{ id: 'booked', label: 'Booked', description: '' }] }));
    await user.type(screen.getByLabelText('Outcome 1 label'), ' a visit');
    expect(last(onChange).outcomes).toEqual([{ id: 'booked', label: 'Booked a visit', description: '' }]);
    expect(CATALOG.ai.outputs(last(onChange)).map((o) => o.id)).toContain('outcome:booked');
  });

  it('outcomeIdChangeDropsHandle', async () => {
    const { onChange, user } = await open(aiNode({ outcomes: [{ id: 'booked', label: 'Booked', description: '' }] }));
    const id = screen.getByLabelText('Outcome 1 id');
    await user.clear(id);
    await user.type(id, 'paid');
    const ids = CATALOG.ai.outputs(last(onChange)).map((o) => o.id);
    expect(ids).toContain('outcome:paid');
    expect(ids).not.toContain('outcome:booked');
  });

  it('overridePlaceholderShowsProfileValueAndReset', async () => {
    const { onChange, user } = await open(aiNode());
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    const model = await screen.findByLabelText('Model override');
    await waitFor(() => expect(model).toHaveAttribute('placeholder', 'gpt-5 — profile'));
    await user.type(model, 'gpt-5-mini');
    expect(last(onChange)).toMatchObject({ overrides: { model: 'gpt-5-mini' } });
    await user.click(screen.getByRole('button', { name: 'Reset model' }));
    expect((last(onChange).overrides as Record<string, unknown>).model ?? null).toBeNull();
  });

  it('capabilitiesHideTemperature', async () => {
    const { user } = await open(aiNode({ profileId: 'p2' }));
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(await screen.findByLabelText('Model override')).toBeVisible();
    await waitFor(() => expect(screen.queryByLabelText('Temperature override')).toBeNull());
    expect(screen.queryByLabelText('Reasoning effort override')).toBeNull();
    await open(aiNode({ profileId: 'p1' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Advanced' }));
    expect(await screen.findByLabelText('Temperature override')).toBeVisible();
  });

  it('jsonSchemaInvalidShowsError', async () => {
    const { user } = await open(aiNode());
    await user.selectOptions(screen.getByLabelText('Reply format'), 'JSON');
    const schema = screen.getByLabelText(/^JSON schema/);
    await user.click(schema);
    await user.paste('{"type":');
    expect(await screen.findByText('Not valid JSON')).toBeVisible();
  });

  it('messageFieldFromSchema', async () => {
    const schema = {
      type: 'object',
      properties: { message: { type: 'string' }, done: { type: 'boolean' }, note: { type: 'string' } },
    };
    const { onChange, user } = await open(aiNode({ replyFormat: { type: 'JSON', schema, messageField: null } }));
    const field = screen.getByLabelText('Message field');
    expect(
      within(field)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose…', 'message', 'note']);
    await user.selectOptions(field, 'message');
    expect(last(onChange)).toMatchObject({ replyFormat: { type: 'JSON', schema, messageField: 'message' } });
  });

  it('exitConditionUsesGroupEditor', async () => {
    const { onChange, user } = await open(aiNode({ mode: 'CONVERSATION' }));
    await user.click(screen.getByRole('button', { name: 'Add exit condition' }));
    const rule = screen.getByRole('group', { name: 'Exit condition 1' });
    await user.type(within(rule).getByLabelText('Variable'), 'x');
    expect(last(onChange).exitCondition).toMatchObject({
      combinator: 'and',
      rules: [{ field: '{{Sales.json.x', operator: 'is' }],
    });
    expect(CATALOG.ai.outputs(last(onChange)).map((o) => o.id)).toContain('exitCondition');
  });

  it('serverErrorsShowOnFields', async () => {
    await open(
      aiNode({
        outcomes: [
          { id: 'a', label: 'A', description: '' },
          { id: 'a', label: 'B', description: '' },
        ],
      }),
      {
        problems: [
          {
            nodeId: 'ai1',
            nodeName: 'Sales',
            field: 'settings.outcomes.1.id',
            message: 'is used twice',
            severity: 'ERROR',
          },
        ],
      },
    );
    const row = screen.getByRole('group', { name: 'Outcome 2' });
    expect(within(row).getAllByText('is used twice').length).toBeGreaterThan(0);
  });

  it('continueFromListsEarlierAiNodes', async () => {
    const first = aiNode({}, 'ai0', 'Greeter');
    const second = aiNode({}, 'ai1', 'Sales');
    const flow: SavedFlow = {
      nodes: [first, second],
      edges: [{ id: 'e', source: 'ai0', sourceHandle: 'maxTurns', target: 'ai1' }],
    };
    const { onChange, user } = await open(second, { flow });
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    const select = await screen.findByLabelText('Continue the conversation of');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['A new conversation', 'Greeter']);
    await user.selectOptions(select, 'Greeter');
    expect(last(onChange)).toMatchObject({ continueFrom: 'Greeter' });
  });

  it('userMessageHintNamesTheTriggerVariable', async () => {
    await open(aiNode({ mode: 'CONVERSATION' }));
    expect(screen.getByText(/\{\{event\.message\.text\}\}/)).toBeVisible();
  });
});
