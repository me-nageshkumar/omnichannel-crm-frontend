import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Rule, RuleGroup } from '@app/api/contacts';
import { LabelPicker } from '@app/Contacts/FilterPanel';
import { RuleTreeEditor } from '@app/Contacts/Filters/RuleTreeEditor';
import { emptyGroup } from '@app/Contacts/Filters/filterModel';
import { LAPSED_TREE, attribute, label } from '../../../test/contacts';

const LABELS = [label({ id: 'l1', name: 'VIP' }), label({ id: 'l2', name: 'Lead' })];
const ATTRIBUTES = [attribute({ id: 'a1', name: 'City' })];

const Harness: React.FunctionComponent<{
  initial?: RuleGroup;
  errors?: Record<string, string>;
  seen: RuleGroup[];
}> = ({ initial, errors, seen }) => {
  const [tree, setTree] = React.useState<RuleGroup>(initial ?? emptyGroup());
  return (
    <RuleTreeEditor
      value={tree}
      onChange={(next) => {
        seen.push(next);
        setTree(next);
      }}
      labels={LABELS}
      attributes={ATTRIBUTES}
      errors={errors}
    />
  );
};

function setup(initial?: RuleGroup, errors?: Record<string, string>) {
  const seen: RuleGroup[] = [];
  const user = userEvent.setup();
  render(<Harness initial={initial} errors={errors} seen={seen} />);
  return { user, last: () => seen[seen.length - 1] };
}

const rule = (n: string) => within(screen.getByRole('group', { name: n }));
const bar = (n: string) => within(screen.getByRole('toolbar', { name: `${n} actions` }));
const optionNames = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('RuleTreeEditor', () => {
  it('buildsTheSpecTreeByRoleAndName', async () => {
    const { user, last } = setup();
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Labels');
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'VIP');
    await user.click(bar('Filter rules').getByRole('button', { name: 'Add rule' }));
    await user.selectOptions(rule('Rule 2').getByLabelText('Field'), 'Last message');
    await user.selectOptions(rule('Rule 2').getByLabelText('Operator'), 'is before');
    fireEvent.change(rule('Rule 2').getByLabelText('Value'), { target: { value: '2026-09-01' } });
    await user.click(bar('Filter rules').getByRole('button', { name: 'Add group' }));
    await user.click(bar('Group 3').getByRole('button', { name: 'Any of these' }));
    await user.click(bar('Group 3').getByRole('checkbox', { name: 'Not' }));
    await user.selectOptions(rule('Rule 3.1').getByLabelText('Field'), 'City');
    await user.selectOptions(rule('Rule 3.1').getByLabelText('Operator'), 'is');
    await user.type(rule('Rule 3.1').getByLabelText('Value'), 'Pune');
    await user.click(bar('Group 3').getByRole('button', { name: 'Add rule' }));
    await user.selectOptions(rule('Rule 3.2').getByLabelText('Field'), 'Source');
    await user.selectOptions(rule('Rule 3.2').getByLabelText('Operator'), 'is any of');
    await user.click(rule('Rule 3.2').getByRole('checkbox', { name: 'Chat' }));
    await user.click(rule('Rule 3.2').getByRole('checkbox', { name: 'Import' }));
    expect(last()).toEqual(LAPSED_TREE);
  });

  it('fieldPickerIsGrouped', () => {
    setup();
    const field = rule('Rule 1').getByLabelText('Field');
    expect(optionNames(within(field).getByRole('group', { name: 'Contact fields' }))).toEqual([
      'Name',
      'Phone',
      'Source',
      'Number hidden',
      'Do not contact',
      'Created',
      'Last message',
    ]);
    expect(optionNames(within(field).getByRole('group', { name: 'Labels' }))).toEqual(['Labels']);
    expect(optionNames(within(field).getByRole('group', { name: 'Attributes' }))).toEqual(['City']);
  });

  it('operatorLabelsFollowTheField', async () => {
    const { user } = setup();
    const field = () => rule('Rule 1').getByLabelText('Field');
    const operators = () => optionNames(rule('Rule 1').getByLabelText('Operator'));
    expect(rule('Rule 1').getByLabelText('Operator')).toBeDisabled();
    await user.selectOptions(field(), 'Labels');
    expect(operators()).toEqual([
      'has',
      'does not have',
      'has any of',
      'has all of',
      'has none of',
      'has no labels',
      'has labels',
    ]);
    await user.selectOptions(field(), 'Phone');
    expect(operators()).toEqual([
      'is',
      'is not',
      'contains',
      'does not contain',
      'starts with',
      'ends with',
      'is set',
      'is not set',
    ]);
    await user.selectOptions(field(), 'Created');
    expect(operators()).toEqual(['is before', 'is after', 'is between', 'is set', 'is not set']);
    await user.selectOptions(field(), 'Do not contact');
    expect(operators()).toEqual(['is']);
    expect(optionNames(rule('Rule 1').getByLabelText('Value'))).toEqual(['Choose a value', 'Yes', 'No']);
  });

  it('valueEditorsFollowTheOperator', async () => {
    const { user, last } = setup();
    const field = () => rule('Rule 1').getByLabelText('Field');
    const operator = () => rule('Rule 1').getByLabelText('Operator');
    await user.selectOptions(field(), 'Name');
    await user.selectOptions(operator(), 'is set');
    expect(rule('Rule 1').queryByLabelText('Value')).not.toBeInTheDocument();
    expect((last().rules[0] as Rule).value).toBeNull();

    await user.selectOptions(field(), 'Created');
    await user.selectOptions(operator(), 'is between');
    fireEvent.change(rule('Rule 1').getByLabelText('From'), { target: { value: '2026-09-01' } });
    fireEvent.change(rule('Rule 1').getByLabelText('To'), { target: { value: '2026-09-30' } });
    expect((last().rules[0] as Rule).value).toEqual(['2026-09-01', '2026-09-30']);

    await user.selectOptions(field(), 'Labels');
    await user.selectOptions(operator(), 'has any of');
    await user.click(rule('Rule 1').getByRole('button', { name: /^Choose labels/ }));
    await user.click(await screen.findByRole('checkbox', { name: /VIP/ }));
    await user.click(screen.getByRole('checkbox', { name: /Lead/ }));
    expect((last().rules[0] as Rule).value).toEqual(['l1', 'l2']);
  });

  it('typingKeepsTheValueInputMounted', async () => {
    const { user, last } = setup();
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Name');
    await user.selectOptions(rule('Rule 1').getByLabelText('Operator'), 'contains');
    const input = rule('Rule 1').getByLabelText('Value');
    await user.type(input, 'Asha Rao');
    expect(rule('Rule 1').getByLabelText('Value')).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Asha Rao');
    expect((last().rules[0] as Rule).value).toBe('Asha Rao');
  });

  it('changingTheFieldResetsTheValue', async () => {
    const { user, last } = setup();
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Name');
    await user.selectOptions(rule('Rule 1').getByLabelText('Operator'), 'contains');
    await user.type(rule('Rule 1').getByLabelText('Value'), 'Asha');
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Source');
    expect(last().rules[0]).toEqual({ field: 'source', operator: 'is', value: '' });
  });

  it('addGroupIsDisabledAtTheFifthLevel', async () => {
    const { user } = setup();
    await user.click(bar('Filter rules').getByRole('button', { name: 'Add group' }));
    await user.click(bar('Group 2').getByRole('button', { name: 'Add group' }));
    await user.click(bar('Group 2.2').getByRole('button', { name: 'Add group' }));
    await user.click(bar('Group 2.2.2').getByRole('button', { name: 'Add group' }));
    expect(bar('Group 2.2.2.2').getByRole('button', { name: 'Add group' })).toBeDisabled();
    expect(bar('Group 2.2.2.2').getByRole('button', { name: 'Add rule' })).toBeEnabled();
    expect(bar('Group 2.2.2').getByRole('button', { name: 'Add group' })).toBeEnabled();
  });

  it('ruleCapDisablesAdding', () => {
    const full: RuleGroup = {
      combinator: 'and',
      not: false,
      rules: Array.from({ length: 50 }, (): Rule => ({ field: 'name', operator: 'isSet', value: null })),
    };
    setup(full);
    expect(bar('Filter rules').getByRole('button', { name: 'Add rule' })).toBeDisabled();
    expect(bar('Filter rules').getByRole('button', { name: 'Add group' })).toBeDisabled();
  });

  it('removesRulesAndGroups', async () => {
    const { user, last } = setup(LAPSED_TREE);
    expect(bar('Filter rules').queryByRole('button', { name: 'Remove group' })).not.toBeInTheDocument();
    await user.click(bar('Group 3').getByRole('button', { name: 'Remove group' }));
    expect(last().rules).toHaveLength(2);
    await user.click(rule('Rule 1').getByRole('button', { name: 'Remove rule' }));
    expect(last().rules).toEqual([LAPSED_TREE.rules[1]]);
  });

  it('removingTheOnlyRuleOfAGroupRemovesIt', async () => {
    const { user, last } = setup();
    await user.click(bar('Filter rules').getByRole('button', { name: 'Add group' }));
    await user.click(rule('Rule 2.1').getByRole('button', { name: 'Remove rule' }));
    expect(screen.queryByRole('group', { name: 'Group 2' })).not.toBeInTheDocument();
    expect(last().rules).toHaveLength(1);
  });

  it('showsMissingAttributeAndLabel', () => {
    setup({
      combinator: 'and',
      not: false,
      rules: [
        { field: 'attributes.a9', operator: 'is', value: 'x' },
        { field: 'labels', operator: 'has', value: 'l9' },
      ],
    });
    expect(rule('Rule 1').getByText('Missing attribute')).toBeInTheDocument();
    expect(rule('Rule 2').getByText('Missing label')).toBeInTheDocument();
    expect(rule('Rule 1').getByLabelText('Field')).toHaveValue('attributes.a9');
    expect(rule('Rule 2').getByLabelText('Value')).toHaveValue('l9');
  });

  it('showsAServerErrorUnderItsRule', () => {
    setup(LAPSED_TREE, { 'rules[1]': 'must be a date' });
    expect(rule('Rule 2').getByText('must be a date')).toBeInTheDocument();
    expect(rule('Rule 1').queryByText('must be a date')).not.toBeInTheDocument();
  });

  it('showsAGroupErrorUnderItsToolbar', () => {
    setup(LAPSED_TREE, { 'rules[2]': 'too deep' });
    expect(within(screen.getByRole('group', { name: 'Group 3' })).getByText('too deep')).toBeInTheDocument();
  });

  it('labelPickerDisablesUnselectedLabelsAtMax', async () => {
    const user = userEvent.setup();
    render(<LabelPicker title="Choose labels" labels={LABELS} selected={['l1']} onChange={() => undefined} max={1} />);
    await user.click(screen.getByRole('button', { name: /^Choose labels/ }));
    expect(await screen.findByRole('checkbox', { name: /VIP/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Lead/ })).toBeDisabled();
  });
});
