import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from '@app/Chatbots/editor/SettingsModal';
import { LEAD_QUALIFIER } from '../../../test/chatbots';

function open(props: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  const onSave = vi.fn();
  render(
    <SettingsModal
      settings={LEAD_QUALIFIER.settings}
      inherited={LEAD_QUALIFIER.inheritedSettings}
      sources={LEAD_QUALIFIER.inheritedSources}
      readOnly={false}
      onSave={onSave}
      onClose={() => undefined}
      {...props}
    />,
  );
  return { onSave, user: userEvent.setup() };
}

describe('SettingsModal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opensWithInheritedValues', () => {
    open();
    expect(screen.getByRole('spinbutton', { name: 'End after minutes' })).toHaveAttribute(
      'placeholder',
      '120 — brand setting',
    );
    expect(screen.getByRole('textbox', { name: 'Retry message' })).toHaveAttribute(
      'placeholder',
      "Sorry, I didn't get that. Please choose… — platform default",
    );
  });

  it('savesOnlyWhatWasSet', async () => {
    const { onSave, user } = open();
    await user.type(screen.getByRole('spinbutton', { name: 'End after minutes' }), '30');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ ...LEAD_QUALIFIER.settings, endAfterMinutes: 30 });
  });

  it('resetReturnsAFieldToTheBrand', async () => {
    const { onSave, user } = open({ settings: { ...LEAD_QUALIFIER.settings, endAfterMinutes: 30 } });
    await user.click(screen.getByRole('button', { name: 'Reset End after minutes' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(LEAD_QUALIFIER.settings);
  });

  it('rangesValidated', async () => {
    const { user } = open();
    await user.type(screen.getByRole('spinbutton', { name: 'End after minutes' }), '3');
    expect(screen.getByText('must be 5 to 2880 minutes')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('readOnlyDisablesEverything', () => {
    open({ readOnly: true });
    expect(screen.getByRole('spinbutton', { name: 'End after minutes' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});
