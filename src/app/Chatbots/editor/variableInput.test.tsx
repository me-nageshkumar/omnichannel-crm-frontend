import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import type { VariableGroup } from '@app/Chatbots/variables';

const GROUPS: VariableGroup[] = [
  { label: 'Contact', paths: [{ path: 'contact.name', hint: 'Name' }, { path: 'contact.phone' }] },
  { label: 'AskBudget', paths: [{ path: 'AskBudget.answer' }] },
];

const Harness: React.FunctionComponent<{ initial?: string }> = ({ initial = '' }) => {
  const [v, setV] = React.useState(initial);
  return (
    <>
      <VariableInput id="t" aria-label="Text" value={v} onChange={setV} variables={GROUPS} />
      <output aria-label="Value">{v}</output>
    </>
  );
};

describe('VariableInput', () => {
  afterEach(() => vi.restoreAllMocks());

  it('insertMenuInsertsAtCaret', async () => {
    const user = userEvent.setup();
    render(<Harness initial="Hi " />);
    const input = screen.getByRole('textbox', { name: 'Text' }) as HTMLInputElement;
    input.setSelectionRange(3, 3);
    await user.click(screen.getByRole('button', { name: 'Insert variable' }));
    await user.click(await screen.findByRole('menuitem', { name: /contact\.name/ }));
    expect(screen.getByLabelText('Value')).toHaveTextContent('Hi {{contact.name}}');
  });

  it('typingBracesOpensSuggestions', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Text' });
    await user.type(input, 'Hi {{{{Ask');
    const option = await screen.findByRole('option', { name: /AskBudget\.answer/ });
    expect(screen.queryByRole('option', { name: /contact\.phone/ })).toBeNull();
    await user.click(option);
    expect(screen.getByLabelText('Value')).toHaveTextContent('Hi {{AskBudget.answer}}');
  });
});
