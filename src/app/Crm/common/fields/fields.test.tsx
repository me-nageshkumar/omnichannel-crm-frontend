import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldInput } from './FieldInput';
import { FieldValue } from './FieldValue';
import { fieldColumns } from './fieldColumns';
import type { FieldDef, FieldType } from './types';

const def = (type: FieldType, extra: Partial<FieldDef> = {}): FieldDef => ({
  key: 'f',
  label: 'Tier',
  type,
  options: [
    { key: 'gold', label: 'Gold', color: null, position: 1, active: true },
    { key: 'silver', label: 'Silver', color: null, position: 2, active: true },
    { key: 'old', label: 'Old', color: null, position: 3, active: false },
  ],
  required: false,
  active: true,
  showInList: false,
  showInCard: false,
  position: 1,
  ...extra,
});

const USERS = [
  { id: 'u1', name: 'Asha' },
  { id: 'u2', name: 'Ravi' },
];

describe('field components', () => {
  it.each<[FieldType, string, string | null]>([
    ['TEXT', 'INPUT', 'text'],
    ['LONG_TEXT', 'TEXTAREA', null],
    ['NUMBER', 'INPUT', 'number'],
    ['CURRENCY', 'INPUT', 'number'],
    ['BOOLEAN', 'INPUT', 'checkbox'],
    ['DATE', 'INPUT', 'text'],
    ['DATETIME', 'INPUT', 'text'],
    ['SELECT', 'SELECT', null],
    ['URL', 'INPUT', 'url'],
    ['EMAIL', 'INPUT', 'email'],
    ['PHONE', 'INPUT', 'tel'],
    ['USER', 'SELECT', null],
  ])('inputRendersPerType %s', (type, tag, inputType) => {
    render(<FieldInput def={def(type)} value={null} onChange={() => undefined} users={USERS} />);
    const control = screen.getByLabelText('Tier');
    expect(control.tagName).toBe(tag);
    if (inputType) expect(control).toHaveAttribute('type', inputType);
  });

  it('inputRendersPerType MULTI_SELECT', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FieldInput def={def('MULTI_SELECT')} value={['gold']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Tier' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Silver' }));
    expect(onChange).toHaveBeenLastCalledWith(['gold', 'silver']);
  });

  it('inputsReportTypedValues', async () => {
    const user = userEvent.setup();
    const onNumber = vi.fn();
    const { unmount } = render(<FieldInput def={def('NUMBER')} value={null} onChange={onNumber} />);
    await user.type(screen.getByLabelText('Tier'), '7');
    expect(onNumber).toHaveBeenLastCalledWith(7);
    unmount();
    const onBool = vi.fn();
    render(<FieldInput def={def('BOOLEAN')} value={false} onChange={onBool} />);
    await user.click(screen.getByLabelText('Tier'));
    expect(onBool).toHaveBeenLastCalledWith(true);
  });

  it('inputShowsErrorAndRequired', () => {
    render(<FieldInput def={def('TEXT', { required: true })} value="" onChange={() => undefined} error="Bad value" />);
    expect(screen.getByText('Bad value')).toBeInTheDocument();
    expect(screen.getByLabelText(/Tier/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('inactiveOptionShownAsInactive', () => {
    const { unmount } = render(<FieldInput def={def('SELECT')} value="old" onChange={() => undefined} />);
    const select = screen.getByLabelText('Tier');
    expect(within(select).getByRole('option', { name: 'Old (inactive)' })).toBeInTheDocument();
    unmount();
    render(<FieldInput def={def('SELECT')} value="gold" onChange={() => undefined} />);
    expect(within(screen.getByLabelText('Tier')).queryByRole('option', { name: /Old/ })).toBeNull();
  });

  it('valueRendersReadable', () => {
    const { container, unmount } = render(<FieldValue def={def('MULTI_SELECT')} value={['gold', 'old']} />);
    expect(container).toHaveTextContent('Gold, Old');
    unmount();
    render(<FieldValue def={def('URL')} value="https://example.com" />);
    expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('columnsOnlyShowInListActive', () => {
    const cols = fieldColumns([
      def('SELECT', { key: 'tier', label: 'Tier', showInList: true, position: 2 }),
      def('TEXT', { key: 'hidden', label: 'Hidden', showInList: false, position: 1 }),
      def('TEXT', { key: 'gone', label: 'Gone', showInList: true, active: false, position: 0 }),
      def('NUMBER', { key: 'size', label: 'Size', showInList: true, position: 1 }),
    ]);
    expect(cols.map((c) => c.title)).toEqual(['Size', 'Tier']);
    render(<>{cols[1].render({ customFields: { tier: 'gold' } })}</>);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });
});
