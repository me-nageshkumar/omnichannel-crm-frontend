import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AutomationAction, AutomationOptions } from '@app/api/automations';
import { AssignChatModal } from '@app/Automations/AssignChatModal';
import { renderApp } from '../../test/renderApp';
import { type MockRoute, mockFetch } from '../../test/fetchMock';
import { AUTOMATIONS_BASE, OPTIONS, WELCOME_RULE, automationRoutes } from '../../test/automations';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const NEW: AutomationAction = { type: 'ASSIGN_CHAT', mode: 'AGENT', userId: null, teamId: null, whenAway: null };

function setup(options: AutomationOptions = OPTIONS, action = NEW) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(<AssignChatModal action={action} options={options} onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel, user };
}

describe('assign chat dialog', () => {
  it('agentWithAwayFallback', async () => {
    const { onSave, user } = setup();
    expect(screen.getByRole('heading', { name: 'Assign chat' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Leave the chat with them' })).toBeChecked();
    expect(screen.getByText('When the number has no team, the chat stays with the agent.')).toBeVisible();
    expect(screen.getByText("This replaces whatever the inbox's routing did.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Agent'), 'Demo Agent');
    await user.click(
      screen.getByRole('radio', { name: "Put it in the queue of the team that owns the chat's number" }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      type: 'ASSIGN_CHAT',
      mode: 'AGENT',
      userId: 'u1',
      teamId: null,
      whenAway: 'OWNING_TEAM_QUEUE',
    });
  });

  it('teamRoundRobin', async () => {
    const { onSave, user } = setup();
    await user.click(screen.getByRole('radio', { name: 'A team, round robin' }));
    expect(
      screen.getByText(
        "The next available member in turn, sharing the team's turn with the inbox's routing. Nobody available: the team's queue.",
      ),
    ).toBeVisible();
    expect(screen.getByText("This replaces whatever the inbox's routing did.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Team'), 'Support');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      type: 'ASSIGN_CHAT',
      mode: 'TEAM_ROUND_ROBIN',
      userId: null,
      teamId: 't1',
      whenAway: null,
    });
  });

  it('teamQueue', async () => {
    const { onSave, user } = setup();
    await user.click(screen.getByRole('radio', { name: 'A team, to its queue' }));
    await user.selectOptions(screen.getByLabelText('Team'), 'Support');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      type: 'ASSIGN_CHAT',
      mode: 'TEAM_QUEUE',
      userId: null,
      teamId: 't1',
      whenAway: null,
    });
  });

  it('warnsWhenAgentCannotSeeANumber', async () => {
    const options: AutomationOptions = {
      ...OPTIONS,
      numbers: [
        ...OPTIONS.numbers,
        { id: 'n3', number: '919928088745', label: 'Billing line', owningTeam: { id: 't9', name: 'Billing' } },
      ],
    };
    const { user } = setup(options);
    await user.selectOptions(screen.getByLabelText('Agent'), 'Demo Agent');
    expect(
      screen.getByText(
        /This rule applies to every number of the brand\. Demo Agent cannot see Billing line; the chat will not be assigned on those numbers\./,
      ),
    ).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Agent'), 'Demo Manager');
    expect(screen.queryByText(/cannot see/)).toBeNull();
  });

  it('saveDisabledUntilChosen', async () => {
    const { onCancel, user } = setup();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Agent'), 'Demo Agent');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('radio', { name: 'A team, to its queue' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('assign chat in the editor', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  const open = () => {
    const routes: Record<string, MockRoute> = {
      ...meAs(WORKSPACE_MANAGER),
      ...automationRoutes({ [`GET ${AUTOMATIONS_BASE}/rules/r1`]: { status: 200, body: WELCOME_RULE } }),
    };
    mockFetch(routes);
    return renderApp('/automations/new');
  };
  const add = async (user: ReturnType<typeof renderApp>['user']) => {
    await user.click(await screen.findByRole('button', { name: 'Add action' }));
    await user.click(await screen.findByRole('menuitem', { name: /^Assign chat/ }));
  };

  it('editorOpensDialogOnAdd', async () => {
    const { user } = open();
    await add(user);
    expect(await screen.findByRole('heading', { name: 'Assign chat', level: 1 })).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'A team, round robin' }));
    await user.selectOptions(screen.getByLabelText('Team'), 'Support');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Round robin in Support')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancellingAFreshActionRemovesIt', async () => {
    const { user } = open();
    await add(user);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: '1. Assign chat' })).toBeNull();
  });
});
