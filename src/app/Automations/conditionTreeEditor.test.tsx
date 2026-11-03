import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConditionGroup, ConditionLeaf, ConditionNode, EventKind } from '@app/api/automations';
import { ConditionTreeEditor } from '@app/Automations/ConditionTreeEditor';
import { OPTIONS } from '../../test/automations';

const Harness: React.FunctionComponent<{
  event: EventKind;
  initial: ConditionGroup | null;
  errors: Record<string, string>;
  seen: (ConditionGroup | null)[];
}> = ({ event, initial, errors, seen }) => {
  const [root, setRoot] = React.useState<ConditionGroup | null>(initial);
  return (
    <ConditionTreeEditor
      event={event}
      root={root}
      options={OPTIONS}
      errors={errors}
      isDisabled={false}
      onChange={(next) => {
        seen.push(next);
        setRoot(next);
      }}
    />
  );
};

function setup(
  initial: ConditionGroup | null = null,
  { event = 'MESSAGE_RECEIVED', errors = {} }: { event?: EventKind; errors?: Record<string, string> } = {},
) {
  const seen: (ConditionGroup | null)[] = [];
  const user = userEvent.setup();
  render(<Harness event={event} initial={initial} errors={errors} seen={seen} />);
  return { user, last: () => seen[seen.length - 1] };
}

const leaf = (field: string, operator: string, value: ConditionLeaf['value']): ConditionLeaf => ({
  field,
  operator,
  value,
});
const g = (combinator: 'and' | 'or', ...rules: ConditionNode[]): ConditionGroup => ({ combinator, not: false, rules });
const row = (n: string) => within(screen.getByRole('group', { name: `Condition ${n}` }));
const bar = (n: string) => within(screen.getByRole('toolbar', { name: `${n} actions` }));
const ALL_KINDS = ['TEXT', 'PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACT_CARD', 'POLL'];

describe('ConditionTreeEditor', () => {
  it('addsAConditionAndAGroup', async () => {
    const { user, last } = setup();
    expect(screen.getByText('No conditions: every message that comes in runs this rule.')).toBeVisible();
    await user.click(bar('Conditions').getByRole('button', { name: 'Add condition' }));
    expect(last()).toEqual(g('and', leaf('chat.new', 'is', true)));
    expect(screen.queryByText(/^No conditions/)).toBeNull();
    await user.click(bar('Conditions').getByRole('button', { name: 'Add group' }));
    expect(last()).toEqual(g('and', leaf('chat.new', 'is', true), g('and', leaf('chat.new', 'is', true))));
    expect(row('2.1').getByLabelText('Field')).toHaveValue('chat.new');
    await user.click(bar('Group 2').getByRole('button', { name: 'Any of these' }));
    expect((last()?.rules[1] as ConditionGroup).combinator).toBe('or');
    await user.click(bar('Group 2').getByRole('button', { name: 'Remove group' }));
    expect(last()).toEqual(g('and', leaf('chat.new', 'is', true)));
    await user.click(row('1').getByRole('button', { name: 'Remove condition' }));
    expect(last()).toBeNull();
    expect(screen.getByText('No conditions: every message that comes in runs this rule.')).toBeVisible();
  });

  it('booleanFieldShowsNewOrExisting', async () => {
    const { user, last } = setup(g('and', leaf('message.text', 'contains', '')));
    expect(row('1').getByLabelText('Value')).toHaveAttribute('placeholder', 'For example: price');
    expect(row('1').getByText('The words the contact sent, or a photo’s caption.')).toBeVisible();
    await user.selectOptions(row('1').getByLabelText('Field'), 'Chat');
    expect(row('1').queryByLabelText('Operator')).toBeNull();
    expect(row('1').getByText('Whether this message starts a new chat or continues an existing one.')).toBeVisible();
    await user.selectOptions(row('1').getByLabelText('Value'), 'Chat is existing');
    expect(last()?.rules[0]).toEqual({ field: 'chat.new', operator: 'is', value: false });
    await user.selectOptions(row('1').getByLabelText('Value'), 'Chat is new');
    expect(last()?.rules[0]).toEqual({ field: 'chat.new', operator: 'is', value: true });
  });

  it('messageTypeCheckboxes', async () => {
    const { user, last } = setup(g('and', leaf('chat.new', 'is', true)));
    await user.selectOptions(row('1').getByLabelText('Field'), 'Message type');
    const types = within(row('1').getByRole('group', { name: 'Value' }));
    await user.click(types.getByRole('checkbox', { name: 'Photo' }));
    await user.click(types.getByRole('checkbox', { name: 'Sticker' }));
    expect(last()?.rules[0]).toEqual({ field: 'message.type', operator: 'is_one_of', value: ['PHOTO', 'STICKER'] });
    expect(types.getByRole('checkbox', { name: 'All' })).not.toBeChecked();
    await user.click(types.getByRole('checkbox', { name: 'All' }));
    expect(last()?.rules[0]).toEqual({ field: 'message.type', operator: 'is_one_of', value: ALL_KINDS });
    expect(types.getByRole('checkbox', { name: 'Audio / voice note' })).toBeChecked();
    await user.click(types.getByRole('checkbox', { name: 'All' }));
    expect(last()?.rules[0]).toEqual({ field: 'message.type', operator: 'is_one_of', value: [] });
  });

  it('betweenHasTwoInputs', async () => {
    const { user, last } = setup(g('and', leaf('deal.amount', 'is', null)), { event: 'DEAL_LANE_CHANGED' });
    expect(row('1').getByLabelText('Value')).toHaveAttribute('placeholder', 'For example: 5000');
    await user.selectOptions(row('1').getByLabelText('Operator'), 'between');
    expect(row('1').queryByLabelText('Value')).toBeNull();
    await user.type(row('1').getByLabelText('From'), '100');
    await user.type(row('1').getByLabelText('To'), '500');
    expect(last()?.rules[0]).toEqual({ field: 'deal.amount', operator: 'between', value: [100, 500] });
    await user.selectOptions(row('1').getByLabelText('Operator'), 'is empty');
    expect(row('1').queryByLabelText('From')).toBeNull();
    expect(row('1').queryByLabelText('Value')).toBeNull();
    expect(last()?.rules[0]).toEqual({ field: 'deal.amount', operator: 'is_empty', value: null });
  });

  it('depthLimitHidesAddGroup', () => {
    const one = leaf('chat.new', 'is', true);
    setup(g('and', one, g('or', one, g('and', one))));
    expect(bar('Conditions').getByRole('button', { name: 'Add group' })).toBeVisible();
    expect(bar('Group 2').getByRole('button', { name: 'Add group' })).toBeVisible();
    expect(bar('Group 2.2').queryByRole('button', { name: 'Add group' })).toBeNull();
    expect(bar('Group 2.2').getByRole('button', { name: 'Add condition' })).toBeVisible();
  });

  it('thirtyConditionsHideTheAddButtons', () => {
    const rules: ConditionNode[] = [];
    for (let i = 0; i < 30; i++) rules.push(leaf('chat.new', 'is', true));
    setup(g('and', ...rules));
    expect(bar('Conditions').queryByRole('button', { name: 'Add group' })).toBeNull();
    expect(bar('Conditions').queryByRole('button', { name: 'Add condition' })).toBeNull();
  });

  it('rowShowsItsError', () => {
    setup(g('and', leaf('chat.new', 'is', true), g('and', leaf('message.type', 'is_one_of', []))), {
      errors: { 'rules[1].rules[0]': 'Choose at least one type', rules: 'Too many conditions' },
    });
    expect(row('2.1').getByText('Choose at least one type')).toBeVisible();
    expect(row('1').queryByText('Choose at least one type')).toBeNull();
    expect(screen.getByText('Too many conditions')).toBeVisible();
  });
});
