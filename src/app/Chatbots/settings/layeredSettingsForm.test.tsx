import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InheritedSource, SettingField, SettingsLayer } from '@app/api/chatbots';
import { LayeredSettingsForm } from '@app/Chatbots/settings/LayeredSettingsForm';
import { EMPTY_LAYER, LayerDraft, fromDraft, toDraft } from '@app/Chatbots/settings/settingsLayers';

const INHERITED: SettingsLayer = {
  reminderOn: false,
  reminderAfterMinutes: 30,
  reminderMessage: 'Are you still there? Reply to carry on.',
  endAfterMinutes: 120,
  endMessage: '',
  invalidReplyRetries: 2,
  retryMessage: "Sorry, I didn't get that. Please choose one of the options.",
  giveUpMessage: '',
  stopOnAgentReply: true,
  whenCompleted: 'CLOSE',
  whenAbandoned: 'ROUTE',
};

const SOURCES: Partial<Record<SettingField, InheritedSource>> = {
  endAfterMinutes: 'BRAND',
  retryMessage: 'PLATFORM',
  stopOnAgentReply: 'PLATFORM',
  whenCompleted: 'PLATFORM',
  whenAbandoned: 'BRAND',
};

/** Renders the form with its own draft state; `latest()` returns the layer the draft stands for. */
function Host(props: {
  initial: SettingsLayer;
  inherited: SettingsLayer | null;
  readOnly?: boolean;
  onDraft(d: LayerDraft): void;
}) {
  const [d, setD] = React.useState<LayerDraft>(() => toDraft(props.initial));
  return (
    <LayeredSettingsForm
      value={d}
      onChange={(next) => {
        setD(next);
        props.onDraft(next);
      }}
      inherited={props.inherited}
      sources={SOURCES}
      readOnly={props.readOnly ?? false}
      errors={{}}
    />
  );
}

function show(initial: SettingsLayer, inherited: SettingsLayer | null = INHERITED, readOnly = false) {
  let draft = toDraft(initial);
  render(<Host initial={initial} inherited={inherited} readOnly={readOnly} onDraft={(d) => (draft = d)} />);
  return { user: userEvent.setup(), latest: () => fromDraft(draft) };
}

describe('LayeredSettingsForm', () => {
  it('inheritedFieldShowsValueAndSource', () => {
    show(EMPTY_LAYER);
    const end = screen.getByRole('spinbutton', { name: 'End after minutes' });
    expect(end).toHaveValue(null);
    expect(end).toHaveAttribute('placeholder', '120 — brand setting');
    expect(screen.queryByRole('button', { name: 'Reset End after minutes' })).toBeNull();
  });

  it('typingSetsTheField', async () => {
    const { user, latest } = show(EMPTY_LAYER);
    await user.type(screen.getByRole('spinbutton', { name: 'End after minutes' }), '45');
    expect(latest().endAfterMinutes).toBe(45);
    expect(latest().retryMessage).toBeNull();
    expect(screen.getByRole('button', { name: 'Reset End after minutes' })).toBeVisible();
  });

  it('resetShowsTheInheritedValue', async () => {
    const { user, latest } = show({ ...EMPTY_LAYER, retryMessage: 'Mine' });
    const retry = screen.getByRole('textbox', { name: 'Retry message' });
    expect(retry).toHaveValue('Mine');
    await user.click(screen.getByRole('button', { name: 'Reset Retry message' }));
    expect(latest().retryMessage).toBeNull();
    expect(retry).toHaveValue('');
    expect(retry).toHaveAttribute('placeholder', "Sorry, I didn't get that. Please choose… — platform default");
  });

  it('sendNoMessageTicks', async () => {
    const { user, latest } = show(EMPTY_LAYER);
    await user.click(screen.getByRole('checkbox', { name: 'Send no end message' }));
    expect(latest().endMessage).toBe('');
    expect(screen.getByRole('textbox', { name: 'End message' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Send no end message' }));
    expect(latest().endMessage).toBeNull();
  });

  it('inheritedSwitchShowsHelper', async () => {
    const { user, latest } = show(EMPTY_LAYER);
    const stop = screen.getByRole('switch', { name: 'Stop when an agent replies' });
    expect(stop).toBeChecked();
    // both switches and "When the chatbot finishes" inherit from the platform here
    expect(screen.getAllByText('From the platform defaults')).toHaveLength(3);
    await user.click(stop);
    expect(latest().stopOnAgentReply).toBe(false);
    expect(screen.getAllByText('From the platform defaults')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Reset Stop when an agent replies' })).toBeVisible();
  });

  it('reminderFieldsShowWhenTheEffectiveReminderIsOn', async () => {
    const { user, latest } = show(EMPTY_LAYER);
    expect(screen.queryByRole('spinbutton', { name: 'Remind after minutes' })).toBeNull();
    await user.click(screen.getByRole('switch', { name: 'Send a reminder' }));
    expect(latest().reminderOn).toBe(true);
    expect(screen.getByRole('spinbutton', { name: 'Remind after minutes' })).toHaveAttribute(
      'placeholder',
      '30 — platform default',
    );
  });

  it('platformLayerHasNoResetOrPlaceholders', () => {
    show(INHERITED, null);
    expect(screen.getByRole('spinbutton', { name: 'End after minutes' })).toHaveValue(120);
    expect(screen.getByRole('spinbutton', { name: 'End after minutes' })).not.toHaveAttribute('placeholder');
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Send no end message' })).toBeChecked();
  });

  it('readOnlyDisablesEverything', () => {
    show({ ...EMPTY_LAYER, endAfterMinutes: 30 }, INHERITED, true);
    expect(screen.getByRole('spinbutton', { name: 'End after minutes' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Stop when an agent replies' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Send no end message' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });

  it('warningShownWhenReminderLate', async () => {
    const { user } = show({ ...EMPTY_LAYER, reminderOn: true });
    const after = screen.getByRole('spinbutton', { name: 'Remind after minutes' });
    await user.type(after, '120');
    expect(screen.getByText('The reminder comes at or after the end, so it will never be sent.')).toBeVisible();
  });

  // review fix: clearing a typed value puts the field back to inherited, and it looks inherited again
  it('clearedFieldShowsTheInheritedValueAgain', async () => {
    const { user, latest } = show(EMPTY_LAYER);
    const end = screen.getByRole('spinbutton', { name: 'End after minutes' });
    await user.type(end, '45');
    await user.clear(end);
    expect(latest().endAfterMinutes).toBeNull();
    expect(end).toHaveAttribute('placeholder', '120 — brand setting');
    expect(screen.queryByRole('button', { name: 'Reset End after minutes' })).toBeNull();
  });

  it('shows the inherited choice and its source for both', () => {
    show(EMPTY_LAYER);
    const finished = screen.getByRole('combobox', { name: 'When the chatbot finishes' });
    const silent = screen.getByRole('combobox', { name: 'When the customer stops answering' });
    expect(finished).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Close the chat — platform default' })).toBeInTheDocument();
    expect(silent).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Send to the team — brand setting' })).toBeInTheDocument();
    expect(screen.getByText('A chatbot that fails always sends the chat to the team.')).toBeInTheDocument();
  });

  it('choosing Close for abandoned chats saves whenAbandoned: CLOSE and leaves the rest inherited', async () => {
    const { user, latest } = show(EMPTY_LAYER);
    await user.selectOptions(screen.getByRole('combobox', { name: 'When the customer stops answering' }), 'CLOSE');
    expect(latest().whenAbandoned).toBe('CLOSE');
    expect(latest().whenCompleted).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: 'When the customer stops answering' }), '');
    expect(latest().whenAbandoned).toBeNull();
  });

  it('an inherited choice says where it comes from; a set one can be reset', async () => {
    const { user, latest } = show({ ...EMPTY_LAYER, whenCompleted: 'ROUTE' });
    expect(screen.getByText("From the brand's settings")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset When the chatbot finishes' }));
    expect(latest().whenCompleted).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset When the chatbot finishes' })).toBeNull();
  });
});
