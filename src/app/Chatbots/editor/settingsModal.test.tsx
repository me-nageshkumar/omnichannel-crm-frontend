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

  it('rangesValidated', async () => {
    const { user } = open();
    const end = screen.getByRole('spinbutton', { name: 'End after minutes' });
    await user.clear(end);
    await user.type(end, '3');
    expect(screen.getByText('Between 5 and 2880 minutes')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('reminderNeedsMinutesAndMessage', async () => {
    const { user } = open();
    await user.click(screen.getByRole('switch', { name: 'Send a reminder' }));
    expect(screen.getByText('Between 1 and 1440 minutes')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(screen.getByRole('spinbutton', { name: 'Remind after minutes' }), '30');
    await user.type(screen.getByRole('textbox', { name: 'Reminder message' }), 'Still there?');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('savesSettings', async () => {
    const { onSave, user } = open();
    const end = screen.getByRole('spinbutton', { name: 'End after minutes' });
    await user.clear(end);
    await user.type(end, '90');
    await user.click(screen.getByRole('switch', { name: 'Stop when an agent replies' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ ...LEAD_QUALIFIER.settings, endAfterMinutes: 90, stopOnAgentReply: false });
  });

  it('readOnlyDisablesEverything', () => {
    open({ readOnly: true });
    expect(screen.getByRole('spinbutton', { name: 'End after minutes' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });
});
