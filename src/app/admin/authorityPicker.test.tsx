import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Authority } from '@app/api/authorities';
import { AuthorityPicker } from '@app/admin/AuthorityPicker';

const authority = (code: string, group: string, description: string): Authority => ({
  code,
  group,
  level: 'BRAND',
  description,
  builtIn: true,
  status: 'ACTIVE',
  checkedIn: [],
  roles: [],
  updatedAt: null,
  updatedBy: null,
});

const ALL = [
  authority('crm:view', 'crm', 'Open the CRM'),
  authority('crm:export', 'crm', 'Export CRM records'),
  authority('inbox:view', 'inbox', 'Open the inbox'),
];

const Harness: React.FC<{ onChange(next: string[]): void; disabledCodes?: Record<string, string> }> = ({
  onChange,
  disabledCodes,
}) => {
  const [selected, setSelected] = React.useState<string[]>(['crm:view']);
  return (
    <AuthorityPicker
      authorities={ALL}
      selected={selected}
      onChange={(next) => {
        setSelected(next);
        onChange(next);
      }}
      disabledCodes={disabledCodes}
      idPrefix="pick"
    />
  );
};

describe('AuthorityPicker', () => {
  it('groups the authorities and counts what is selected', () => {
    render(<Harness onChange={() => undefined} />);
    const crm = screen.getByRole('region', { name: 'crm' });
    expect(within(crm).getByText('1 of 2 selected')).toBeVisible();
    expect(within(crm).getByRole('checkbox', { name: /Open the CRM/ })).toBeChecked();
    expect(within(screen.getByRole('region', { name: 'inbox' })).getByText('0 of 1 selected')).toBeVisible();
  });

  it('adds and removes a code', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Export CRM records/ }));
    expect(onChange).toHaveBeenLastCalledWith(['crm:view', 'crm:export']);
    await userEvent.click(screen.getByRole('checkbox', { name: /Open the CRM/ }));
    expect(onChange).toHaveBeenLastCalledWith(['crm:export']);
  });

  it('searches by code, group or description', async () => {
    render(<Harness onChange={() => undefined} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search authorities' }), 'export');
    expect(screen.getByRole('checkbox', { name: /Export CRM records/ })).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: /Open the CRM/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'inbox' })).toBeNull();
  });

  it('disables a code with its reason', () => {
    render(<Harness onChange={() => undefined} disabledCodes={{ 'inbox:view': 'In group Inbox' }} />);
    expect(screen.getByRole('checkbox', { name: /Open the inbox/ })).toBeDisabled();
    expect(screen.getByText(/In group Inbox/)).toBeVisible();
  });
});
