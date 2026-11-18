import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SavedNode } from '@app/api/chatbots';
import { NodeDrawer } from '@app/Chatbots/editor/NodeDrawer';
import '@app/Chatbots/nodes';
import { CATALOG } from '@app/Chatbots/nodeCatalog';
import { SessionProvider } from '@app/session/SessionContext';
import { LEAD_QUALIFIER, OPTIONS } from '../../../test/chatbots';
import { mockFetch } from '../../../test/fetchMock';

function node(
  type: SavedNode['type'],
  settings: Record<string, unknown> = CATALOG[type].defaultSettings(),
  name = 'Node1',
): SavedNode {
  return { id: 'x', type, position: { x: 0, y: 0 }, data: { name, settings } };
}

/** The editor keeps the settings; the drawer is controlled. Each change is recorded and applied, as the page does. */
const Harness: React.FunctionComponent<{
  node: SavedNode;
  onChange: (s: Record<string, unknown>) => void;
  props: Partial<React.ComponentProps<typeof NodeDrawer>>;
}> = ({ node: initial, onChange, props }) => {
  const [n, setN] = React.useState(initial);
  return (
    <SessionProvider>
      <NodeDrawer
        node={n}
        flow={{ ...LEAD_QUALIFIER.flow, nodes: LEAD_QUALIFIER.flow.nodes.concat([n]) }}
        chatbotId="c1"
        options={OPTIONS}
        problems={[]}
        readOnly={false}
        onChange={(settings) => {
          onChange(settings);
          setN((cur) => ({ ...cur, data: { ...cur.data, settings } }));
        }}
        onClose={() => undefined}
        {...props}
      />
    </SessionProvider>
  );
};

/** Renders one drawer; an earlier one in the same test is unmounted first so `screen` queries see one dialog. */
function open(n: SavedNode, props: Partial<React.ComponentProps<typeof NodeDrawer>> = {}) {
  cleanup();
  mockFetch({});
  const onChange = vi.fn();
  render(<Harness node={n} onChange={onChange} props={props} />);
  return { onChange, user: userEvent.setup() };
}

const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0] as Record<string, unknown>;

describe('node fields', () => {
  afterEach(() => vi.restoreAllMocks());

  it('askQuestionEditsSettings', async () => {
    const { onChange, user } = open(node('ask_question'));
    await user.selectOptions(screen.getByLabelText('Answer type'), 'NUMBER');
    expect(last(onChange)).toMatchObject({ answerType: 'NUMBER' });
    await user.type(screen.getByLabelText('Question'), 'Budget?');
    expect(String(last(onChange).text)).toContain('Budget?');
  });

  it('askFormAddsFieldAndSlugsKey', async () => {
    const { onChange, user } = open(node('ask_form'));
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    const fields = last(onChange).fields as Record<string, unknown>[];
    expect(fields).toHaveLength(1);
    const { onChange: onChange2, user: user2 } = open(
      node('ask_form', {
        ...CATALOG.ask_form.defaultSettings(),
        fields: [{ key: '', label: '', type: 'TEXT', required: true, options: [] }],
      }),
    );
    await user2.type(screen.getAllByLabelText('Field label')[0], 'Monthly budget');
    const f = (last(onChange2).fields as Record<string, unknown>[])[0];
    expect(f.label).toBe('Monthly budget');
    expect(f.key).toBe('monthly_budget');
  });

  it('askFormLinkMessageNeedsPlaceholder', () => {
    open(node('ask_form', { ...CATALOG.ask_form.defaultSettings(), linkMessage: 'Fill this' }));
    expect(screen.getByText('must contain {{form.url}}')).toBeVisible();
  });

  it('conditionAddsCaseAndRule', async () => {
    const { onChange, user } = open(node('condition'));
    await user.click(screen.getByRole('button', { name: 'Add case' }));
    let cases = last(onChange).cases as Record<string, unknown>[];
    expect(cases).toHaveLength(1);
    expect(cases[0].conditions).toEqual({ combinator: 'and', not: false, rules: [] });
    const { onChange: on2, user: u2 } = open(
      node('condition', {
        cases: [{ id: 'c1', label: 'High', conditions: { combinator: 'and', not: false, rules: [] } }],
      }),
    );
    await u2.click(screen.getByRole('button', { name: 'Add condition' }));
    cases = last(on2).cases as Record<string, unknown>[];
    const rules = (cases[0].conditions as { rules: Record<string, unknown>[] }).rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({ field: '', operator: 'is', value: '' });
  });

  it('updateContactRow', async () => {
    const { onChange, user } = open(node('update_contact'));
    await user.click(screen.getByRole('button', { name: 'Set an attribute' }));
    await user.selectOptions(screen.getByLabelText('Attribute 1'), 'a1');
    expect(last(onChange)).toMatchObject({ setAttributes: { a1: '' } });
  });

  it('httpHeadersRowAndMethod', async () => {
    const { onChange, user } = open(node('http_request'));
    await user.selectOptions(screen.getByLabelText('Method'), 'GET');
    expect(last(onChange)).toMatchObject({ method: 'GET' });
    await user.click(screen.getByRole('button', { name: 'Add header' }));
    await user.type(screen.getByLabelText('Header 1 name'), 'X-Token');
    expect(Object.keys(last(onChange).headers as Record<string, string>)).toEqual(['X-Token']);
  });

  it('waitUnit', async () => {
    const { onChange, user } = open(node('wait'));
    await user.selectOptions(screen.getByLabelText('Unit'), 'DAYS');
    expect(last(onChange)).toMatchObject({ amount: 1, unit: 'DAYS' });
    expect(screen.getByText('1 minute to 30 days')).toBeVisible();
  });

  it('jumpExcludesSelf', () => {
    open(node('jump'));
    const select = screen.getByLabelText('Chatbot') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain('Price bot');
    expect(labels.some((l) => l && l.indexOf('Lead qualifier') >= 0)).toBe(false);
  });

  it('sendMessageKindSwitchKeepsInteractiveDraft', async () => {
    const { onChange, user } = open(node('send_message', LEAD_QUALIFIER.flow.nodes[0].data.settings));
    expect(screen.getByRole('button', { name: 'Text' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Text' }));
    expect((last(onChange).message as { type: string }).type).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Interactive' }));
    const back = last(onChange).message as { type: string; interactive: { action: { buttons: unknown[] } } };
    expect(back.type).toBe('interactive');
    expect(back.interactive.action.buttons).toHaveLength(2);
  });

  it('errorsShowUnderFieldsAndReadOnlyDisables', () => {
    open(node('ask_question'), {
      problems: [{ nodeId: 'x', nodeName: 'Node1', field: 'settings.text', message: 'is required', severity: 'ERROR' }],
    });
    expect(screen.getAllByText('is required').length).toBeGreaterThan(0);
    const { user } = open(node('wait'), { readOnly: true });
    expect(screen.getByLabelText('Unit')).toBeDisabled();
    void user;
  });

  it('assignChatModeAndTeam', async () => {
    const { onChange, user } = open(
      node('assign_chat', { mode: 'TEAM_QUEUE', userId: null, teamId: null, whenAway: null }),
    );
    await user.selectOptions(screen.getByLabelText('Team'), 't1');
    expect(last(onChange)).toMatchObject({ mode: 'TEAM_QUEUE', teamId: 't1' });
    await user.click(screen.getByRole('radio', { name: 'An agent' }));
    expect(last(onChange)).toMatchObject({ mode: 'AGENT' });
  });

  it('doNotContactAndAddToCrm', async () => {
    const { onChange, user } = open(node('do_not_contact'));
    await user.click(screen.getByRole('radio', { name: 'Clear the mark' }));
    expect(last(onChange)).toEqual({ mark: false });
    const { onChange: on2, user: u2 } = open(node('add_to_crm'));
    await u2.selectOptions(screen.getByLabelText('Pipeline'), 'p1');
    expect(last(on2)).toMatchObject({ pipelineId: 'p1' });
    const { onChange: on3, user: u3 } = open(node('send_template'));
    await u3.selectOptions(screen.getByLabelText('Template'), 'tp2');
    expect(last(on3)).toMatchObject({ templateId: 'tp2' });
    expect(within(screen.getByRole('dialog', { name: 'Node1' })).getByLabelText(/Order id/)).toBeVisible();
  });

  it("choosing the number's routing hides the target fields and saves nulls", async () => {
    const { onChange, user } = open(
      node('assign_chat', { mode: 'TEAM_QUEUE', userId: null, teamId: 't1', whenAway: null }),
    );
    expect(screen.getByLabelText('Team')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: "The number's normal routing" }));
    expect(last(onChange)).toEqual({ mode: 'NUMBER_ROUTING', userId: null, teamId: null, whenAway: null });
    expect(screen.queryByLabelText('Team')).toBeNull();
    expect(screen.queryByLabelText('Agent')).toBeNull();
    expect(
      screen.getByText('The chatbot ends here. To tell the customer first, put a Send message node before this one.'),
    ).toBeInTheDocument();
  });

  it("a new hand-over starts on the number's routing", () => {
    open(node('assign_chat'));
    expect(screen.getByRole('radio', { name: "The number's normal routing" })).toBeChecked();
  });
});
