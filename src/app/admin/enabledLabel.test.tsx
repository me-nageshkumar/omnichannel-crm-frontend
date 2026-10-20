import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnabledLabel } from '@app/admin/EnabledLabel';
import { levelText } from '@app/api/enablement';

describe('EnabledLabel', () => {
  it('shows Enabled without a disable record', () => {
    render(<EnabledLabel disabled={null} />);
    expect(screen.getByText('Enabled')).toBeVisible();
  });

  it('names who disabled it, at which level, on hover', async () => {
    render(<EnabledLabel disabled={{ by: 'boss', level: 'COMPANY', at: '2026-10-20T10:00:00Z' }} />);
    await userEvent.hover(screen.getByText('Disabled'));
    expect(await screen.findByText(/Disabled by boss \(Customer Admin\) on/)).toBeInTheDocument();
  });

  it('describes each level', () => {
    expect(levelText('PLATFORM')).toBe('platform staff');
    expect(levelText('COMPANY')).toBe('Customer Admin');
    expect(levelText('BRAND')).toBe('brand manager');
  });
});
