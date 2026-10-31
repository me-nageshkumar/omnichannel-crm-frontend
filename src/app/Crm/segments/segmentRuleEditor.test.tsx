import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider } from '@app/session/SessionContext';
import { mockFetch } from '../../../test/fetchMock';
import type { SegmentRule, SegmentRuleGroup } from '@app/api/crm';
import type { ContactLabel } from '@app/api/contacts';
import { SegmentRuleEditor } from '@app/Crm/segments/SegmentRuleEditor';
import { emptyGroup } from '@app/Crm/segments/segmentModel';
import { sampleSegmentFields } from '../../../test/crm';

const CATALOG = sampleSegmentFields();
const label = (id: string, name: string): ContactLabel => ({
  id,
  name,
  color: 'blue',
  description: null,
  contactCount: 0,
});
const LABELS = [label('l1', 'VIP'), label('l2', 'Gold')];
const USERS = [
  { id: 'u1', name: 'Asha Rao' },
  { id: 'u2', name: 'Ravi Kumar' },
];

const Harness: React.FunctionComponent<{
  initial?: SegmentRuleGroup;
  errors?: Record<string, string>;
  seen: SegmentRuleGroup[];
}> = ({ initial, errors, seen }) => {
  const [tree, setTree] = React.useState<SegmentRuleGroup>(initial ?? emptyGroup());
  return (
    <SegmentRuleEditor
      value={tree}
      catalog={CATALOG}
      labels={LABELS}
      users={USERS}
      errors={errors ?? {}}
      onChange={(next) => {
        seen.push(next);
        setTree(next);
      }}
    />
  );
};

function setup(initial?: SegmentRuleGroup, errors?: Record<string, string>) {
  const seen: SegmentRuleGroup[] = [];
  const user = userEvent.setup();
  mockFetch({});
  render(
    <MemoryRouter>
      <SessionProvider>
        <Harness initial={initial} errors={errors} seen={seen} />
      </SessionProvider>
    </MemoryRouter>,
  );
  return { user, last: () => seen[seen.length - 1] };
}

const rule = (n: string) => within(screen.getByRole('group', { name: n }));
const bar = (n: string) => within(screen.getByRole('toolbar', { name: `${n} actions` }));
const optionNames = (el: HTMLElement) =>
  within(el)
    .getAllByRole('option')
    .map((o) => o.textContent);
const r = (field: string, operator: string, value: SegmentRule['value'] = null): SegmentRule => ({
  field,
  operator,
  value,
});
const g = (combinator: 'and' | 'or', ...rules: (SegmentRule | SegmentRuleGroup)[]): SegmentRuleGroup => ({
  combinator,
  not: false,
  rules,
});

describe('SegmentRuleEditor', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fieldSelectIsGroupedByCatalogue', () => {
    setup();
    const field = rule('Rule 1').getByLabelText('Field');
    expect(optionNames(within(field).getByRole('group', { name: 'CRM contact' }))).toContain('Lifecycle');
    expect(optionNames(within(field).getByRole('group', { name: 'Has a deal where' }))).toEqual([
      'Pipeline',
      'Stage',
      'Status',
      'Amount',
      'Days in stage',
    ]);
    expect(optionNames(within(field).getByRole('group', { name: 'Channel contact' }))).toContain('City');
  });

  it('operatorsFollowTheFieldType', async () => {
    const { user, last } = setup();
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Amount');
    expect(optionNames(rule('Rule 1').getByLabelText('Operator'))).toEqual([
      'equals',
      "doesn't equal",
      'less than',
      'at most',
      'more than',
      'at least',
      'between',
    ]);
    expect(last().rules[0]).toEqual(r('deal.amount', 'eq', ''));
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Label');
    expect(optionNames(rule('Rule 1').getByLabelText('Operator'))).toEqual([
      'has',
      "doesn't have",
      'has any of',
      'has all of',
      'has none of',
      'is empty',
      'is not empty',
    ]);
  });

  it('valueEditorFollowsTheOperator', async () => {
    const { user, last } = setup();
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Created');
    expect(rule('Rule 1').getByLabelText('Value')).toHaveAttribute('type', 'date');
    await user.selectOptions(rule('Rule 1').getByLabelText('Operator'), 'in the last … days');
    const days = rule('Rule 1').getByLabelText('Value');
    expect(days).toHaveAttribute('type', 'number');
    expect(rule('Rule 1').getByText('days')).toBeInTheDocument();
    await user.type(days, '30');
    expect(last().rules[0]).toEqual(r('contact.creationTime', 'withinLastDays', '30'));
    await user.selectOptions(rule('Rule 1').getByLabelText('Operator'), 'between');
    fireEvent.change(rule('Rule 1').getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(rule('Rule 1').getByLabelText('To'), { target: { value: '2026-02-01' } });
    expect(last().rules[0]).toEqual(r('contact.creationTime', 'between', ['2026-01-01', '2026-02-01']));
    await user.selectOptions(rule('Rule 1').getByLabelText('Operator'), 'is set');
    expect(rule('Rule 1').queryByLabelText('Value')).toBeNull();
  });

  it('stageOptionsFollowThePipelineRule', async () => {
    const { user, last } = setup(g('and', r('deal.pipelineId', 'is', 'p2'), r('deal.stageId', 'is', '')));
    expect(optionNames(rule('Rule 2').getByLabelText('Value'))).toEqual(['Choose a value', 'Open']);
    await user.selectOptions(rule('Rule 2').getByLabelText('Value'), 'Open');
    expect(last().rules[1]).toEqual(r('deal.stageId', 'is', 's9'));
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'Sales');
    expect(optionNames(rule('Rule 2').getByLabelText('Value'))).toEqual(['Choose a value', 'New', 'Proposal']);
    expect(last().rules[1]).toEqual(r('deal.stageId', 'is', ''));
  });

  it('stageWithoutPipelineIsDisabledWithAHint', () => {
    setup(g('and', r('deal.stageId', 'is', '')));
    expect(rule('Rule 1').getByLabelText('Value')).toBeDisabled();
    expect(rule('Rule 1').getByText('Add a pipeline rule to this group first')).toBeInTheDocument();
  });

  it('andGroupWithTwoDealRulesShowsTheHint', () => {
    const HINT = 'All deal conditions in this group must match the same deal.';
    setup(
      g(
        'and',
        r('deal.status', 'is', 'OPEN'),
        r('deal.amount', 'gt', '5'),
        g('or', r('deal.status', 'is', 'WON'), r('deal.amount', 'gt', '1')),
      ),
    );
    const root = screen.getByRole('group', { name: 'Filter rules' });
    expect(within(root).getAllByText(HINT)).toHaveLength(1);
    expect(within(screen.getByRole('group', { name: 'Group 3' })).queryByText(HINT)).toBeNull();
  });

  it('flaggedRuleIsReadOnlyButRemovable', async () => {
    const { user, last } = setup(
      g(
        'and',
        { field: 'contact.custom:gone', operator: 'is', value: 'x', missing: true } as SegmentRule,
        {
          field: 'deal.pipelineId',
          operator: 'is',
          value: 'p7',
          inaccessible: true,
        } as SegmentRule,
      ),
    );
    expect(rule('Rule 1').getByLabelText('Field')).toBeDisabled();
    expect(rule('Rule 1').getByText('This field no longer exists')).toBeInTheDocument();
    expect(rule('Rule 2').getByText("A pipeline you can't access")).toBeInTheDocument();
    expect(rule('Rule 2').getByLabelText('Operator')).toBeDisabled();
    await user.click(rule('Rule 1').getByRole('button', { name: 'Remove rule' }));
    expect(last().rules).toHaveLength(1);
  });

  it('addRuleDisabledAtThirtyRules', () => {
    const many = g('and', ...Array.from({ length: 30 }, () => r('contact.email', 'isSet')));
    setup(many);
    expect(bar('Filter rules').getByRole('button', { name: 'Add rule' })).toBeDisabled();
    expect(bar('Filter rules').getByRole('button', { name: 'Add group' })).toBeDisabled();
  });

  it('labelPickerForLabelFields', async () => {
    const { user, last } = setup(g('and', r('channel.label', 'hasAny', [])));
    await user.click(rule('Rule 1').getByRole('button', { name: /Choose labels/ }));
    await user.click(await screen.findByRole('checkbox', { name: /VIP/ }));
    expect(last().rules[0]).toEqual(r('channel.label', 'hasAny', ['l1']));
  });

  it('userSelectForUserFields', async () => {
    const { user, last } = setup(g('and', r('contact.ownerId', 'is', '')));
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'Ravi Kumar');
    expect(last().rules[0]).toEqual(r('contact.ownerId', 'is', 'u2'));
  });

  it('companyTypeaheadForCompanyField', () => {
    setup(g('and', r('contact.companyId', 'is', '')));
    expect(rule('Rule 1').getByRole('combobox', { name: /Company/ })).toBeInTheDocument();
  });

  it('errorsLandOnTheirRules', () => {
    setup(
      g('and', r('contact.email', 'is', 'a'), g('and', r('contact.email', 'is', 'b'), r('deal.amount', 'gt', 'x'))),
      {
        'rules[1].rules[1].value': 'must be a number',
        'rules[1]': 'needs a pipeline rule in the same group',
      },
    );
    expect(rule('Rule 2.2').getByText('must be a number')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Group 2' })).getByText('needs a pipeline rule in the same group'),
    ).toBeInTheDocument();
    expect(rule('Rule 1').queryByText('must be a number')).toBeNull();
  });
});
