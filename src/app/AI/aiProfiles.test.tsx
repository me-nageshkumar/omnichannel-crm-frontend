import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { AI_BASE, CONNECTION, PROFILE, SCRIPTED_CONNECTION, aiRoutes } from '../../test/ai';

type User = ReturnType<typeof userEvent.setup>;

function routes(extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    ...aiRoutes(),
    [`GET ${AI_BASE}/connections`]: { status: 200, body: [CONNECTION, SCRIPTED_CONNECTION] },
    [`GET ${AI_BASE}/connections/k2/models`]: { status: 200, body: [{ id: 'scripted-1' }] },
    [`GET ${AI_BASE}/connections/k2/vector-stores`]: { status: 200, body: [] },
    ...extra,
  };
}

async function openProfiles(extra = {}) {
  const fetch = mockFetch(routes(extra));
  renderApp('/ai?tab=profiles');
  await screen.findByRole('row', { name: /Sales assistant/ });
  return fetch;
}

async function editSales(user: User) {
  await user.click(screen.getByRole('button', { name: 'Edit Sales assistant' }));
  return screen.findByRole('dialog', { name: 'Edit profile' });
}

async function addProfile(user: User) {
  await user.click(screen.getByRole('button', { name: 'Add profile' }));
  return screen.findByRole('dialog', { name: 'Add profile' });
}

describe('AI page — profiles', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsProfiles', async () => {
    await openProfiles();
    const row = screen.getByRole('row', { name: /Sales assistant/ });
    expect(within(row).getByText('gpt-5')).toBeVisible();
    expect(within(row).getByText('Main key')).toBeVisible();
  });

  it('fieldsFollowCapabilities', async () => {
    const user = userEvent.setup();
    await openProfiles();
    const dialog = await editSales(user);
    expect(within(dialog).getByLabelText('Reasoning effort')).toBeVisible();
    expect(within(dialog).getByLabelText('Temperature')).toBeVisible();
    expect(within(dialog).getByLabelText('Web search')).toBeVisible();
    expect(within(dialog).getByRole('group', { name: 'Knowledge' })).toBeVisible();
    const connectBy = within(dialog).getByLabelText('Server 1 connect by');
    expect(within(connectBy).getByRole('option', { name: 'Provider' })).not.toBeDisabled();

    await user.selectOptions(within(dialog).getByLabelText(/^Connection/), 'k2');
    expect(within(dialog).queryByLabelText('Reasoning effort')).toBeNull();
    expect(within(dialog).queryByLabelText('Temperature')).toBeNull();
    expect(within(dialog).queryByLabelText('Web search')).toBeNull();
    expect(within(dialog).queryByRole('group', { name: 'Knowledge' })).toBeNull();
    expect(
      within(within(dialog).getByLabelText('Server 1 connect by')).getByRole('option', { name: 'Provider' }),
    ).toBeDisabled();
    expect(within(dialog).getByText('Scripted cannot connect to MCP servers itself.')).toBeVisible();
  });

  it('modelListedWithFreeText', async () => {
    const user = userEvent.setup();
    const fetch = await openProfiles({ [`PUT ${AI_BASE}/profiles/p1`]: { status: 200, body: PROFILE } });
    const dialog = await editSales(user);
    await waitFor(() => expect(dialog.querySelectorAll('datalist option')).toHaveLength(2));
    const model = within(dialog).getByLabelText(/^Model/);
    await user.clear(model);
    await user.type(model, 'my-fine-tune');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, `PUT ${AI_BASE}/profiles/p1`)?.body).toMatchObject({ model: 'my-fine-tune' }),
    );
  });

  it('vectorStoresChecklistAndRefresh', async () => {
    const user = userEvent.setup();
    const fetch = await openProfiles({ [`PUT ${AI_BASE}/profiles/p1`]: { status: 200, body: PROFILE } });
    const dialog = await editSales(user);
    const knowledge = within(dialog).getByRole('group', { name: 'Knowledge' });
    const catalogue = await within(knowledge).findByRole('checkbox', { name: 'Product catalogue (312 files)' });
    expect(catalogue).toBeChecked();
    await user.click(within(knowledge).getByRole('checkbox', { name: 'Return policy (4 files)' }));
    const before = callsTo(fetch, `GET ${AI_BASE}/connections/k1/vector-stores`);
    await user.click(within(knowledge).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(callsTo(fetch, `GET ${AI_BASE}/connections/k1/vector-stores`)).toBe(before + 1));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, `PUT ${AI_BASE}/profiles/p1`)?.body).toMatchObject({ vectorStoreIds: ['vs1', 'vs2'] }),
    );
  });

  it('mcpRowsAddRemove', async () => {
    const user = userEvent.setup();
    const fetch = await openProfiles({ [`POST ${AI_BASE}/profiles`]: { status: 201, body: PROFILE } });
    const dialog = await addProfile(user);
    await user.type(within(dialog).getByLabelText(/^Name/), 'Bot');
    await user.type(within(dialog).getByLabelText(/^Model/), 'gpt-5');
    await user.click(within(dialog).getByRole('button', { name: 'Add MCP server' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add MCP server' }));
    await user.type(within(dialog).getByLabelText('Server 1 label'), 'cal');
    await user.type(within(dialog).getByLabelText('Server 1 URL'), 'https://cal.example/mcp');
    expect(within(dialog).queryByLabelText('Server 1 header name')).toBeNull();
    await user.selectOptions(within(dialog).getByLabelText('Server 1 auth'), 'HEADER');
    await user.type(within(dialog).getByLabelText('Server 1 header name'), 'X-Api-Key');
    await user.type(within(dialog).getByLabelText(/^Server 1 secret/), 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Remove server 2' }));
    expect(within(dialog).queryByLabelText('Server 2 label')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, `POST ${AI_BASE}/profiles`)).toBeDefined());
    expect(requestTo(fetch, `POST ${AI_BASE}/profiles`)?.body).toMatchObject({
      name: 'Bot',
      model: 'gpt-5',
      connectionId: 'k1',
      mcpServers: [
        {
          label: 'cal',
          url: 'https://cal.example/mcp',
          connectBy: 'APP',
          auth: 'HEADER',
          headerName: 'X-Api-Key',
          secret: 'abc',
        },
      ],
    });
  });

  it('loadToolsForAppServer', async () => {
    const user = userEvent.setup();
    const provider = {
      ...PROFILE,
      mcpServers: [
        PROFILE.mcpServers[0],
        { ...PROFILE.mcpServers[0], id: 's2', label: 'hosted', connectBy: 'PROVIDER' as const, allowedTools: [] },
      ],
    };
    const fetch = await openProfiles({
      [`GET ${AI_BASE}/profiles`]: { status: 200, body: [provider] },
      [`GET ${AI_BASE}/profiles/p1`]: { status: 200, body: provider },
      [`POST ${AI_BASE}/profiles/p1/mcp/s1/tools`]: {
        status: 200,
        body: [
          { name: 'book', description: 'Books a slot' },
          { name: 'cancel', description: null },
        ],
      },
      [`PUT ${AI_BASE}/profiles/p1`]: { status: 200, body: provider },
    });
    const dialog = await editSales(user);
    expect(within(dialog).queryByRole('button', { name: 'Load tools for server 2' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Load tools for server 1' }));
    const tools = await within(dialog).findByRole('group', { name: 'Server 1 allowed tools' });
    expect(within(tools).getByRole('checkbox', { name: 'book' })).toBeChecked();
    await user.click(within(tools).getByRole('checkbox', { name: 'cancel' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, `PUT ${AI_BASE}/profiles/p1`)?.body).toMatchObject({
        mcpServers: [{ id: 's1', allowedTools: ['book', 'cancel'] }, { id: 's2' }],
      }),
    );
  });

  it('switchConnectionFlagsProviderRow', async () => {
    const user = userEvent.setup();
    const hosted = { ...PROFILE, mcpServers: [{ ...PROFILE.mcpServers[0], connectBy: 'PROVIDER' as const }] };
    const fetch = await openProfiles({
      [`GET ${AI_BASE}/profiles`]: { status: 200, body: [hosted] },
      [`GET ${AI_BASE}/profiles/p1`]: { status: 200, body: hosted },
      [`PUT ${AI_BASE}/profiles/p1`]: { status: 200, body: hosted },
    });
    const dialog = await editSales(user);
    await user.selectOptions(within(dialog).getByLabelText(/^Connection/), 'k2');
    expect(
      within(dialog).getByText('This provider cannot connect to MCP servers itself; choose Our app'),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(callsTo(fetch, `PUT ${AI_BASE}/profiles/p1`)).toBe(0);
  });

  it('serverFieldErrorsLandOnRows', async () => {
    const user = userEvent.setup();
    const two = {
      ...PROFILE,
      mcpServers: [PROFILE.mcpServers[0], { ...PROFILE.mcpServers[0], id: 's2', label: 'second' }],
    };
    await openProfiles({
      [`GET ${AI_BASE}/profiles`]: { status: 200, body: [two] },
      [`GET ${AI_BASE}/profiles/p1`]: { status: 200, body: two },
      [`PUT ${AI_BASE}/profiles/p1`]: {
        status: 400,
        body: { code: 'VALIDATION', message: 'Invalid', fields: { 'mcpServers.1.url': 'must start with https://' } },
      },
    });
    const dialog = await editSales(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    const msg = await within(dialog).findByText('must start with https://');
    expect(within(dialog).getByRole('group', { name: 'Server 2' })).toContainElement(msg);
  });

  it('mcpSecretWriteOnly', async () => {
    const user = userEvent.setup();
    const fetch = await openProfiles({ [`PUT ${AI_BASE}/profiles/p1`]: { status: 200, body: PROFILE } });
    const dialog = await editSales(user);
    expect(within(dialog).getByText(/tok…9xyz/)).toBeVisible();
    expect(within(dialog).queryByLabelText(/^Server 1 secret/)).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, `PUT ${AI_BASE}/profiles/p1`)).toBeDefined());
    const servers = (requestTo(fetch, `PUT ${AI_BASE}/profiles/p1`)?.body as { mcpServers: object[] }).mcpServers;
    expect(servers[0]).not.toHaveProperty('secret');
    expect(servers[0]).not.toHaveProperty('secretHint');
  });

  it('deleteInUseShowsChatbotNames', async () => {
    const user = userEvent.setup();
    await openProfiles({
      [`DELETE ${AI_BASE}/profiles/p1`]: {
        status: 409,
        body: { code: 'ai_profile_in_use', message: 'Used by chatbots: Lead qualifier' },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Delete Sales assistant' }));
    const dialog = await screen.findByRole('dialog', { name: /Delete profile\?/ });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText('Used by chatbots: Lead qualifier')).toBeVisible();
  });

  it('leastPrivilegeNote', async () => {
    const user = userEvent.setup();
    await openProfiles();
    const dialog = await editSales(user);
    expect(
      within(dialog).getByText(
        "Tools run with this server's own access. Give it only what the bot needs, and list the allowed tools.",
      ),
    ).toBeVisible();
  });

  it('allToolsIsShownAndKeptNamesStay', async () => {
    const user = userEvent.setup();
    const open = { ...PROFILE, mcpServers: [{ ...PROFILE.mcpServers[0], allowedTools: [] }] };
    const fetch = await openProfiles({
      [`GET ${AI_BASE}/profiles`]: { status: 200, body: [open] },
      [`GET ${AI_BASE}/profiles/p1`]: { status: 200, body: open },
      [`POST ${AI_BASE}/profiles/p1/mcp/s1/tools`]: { status: 200, body: [{ name: 'book', description: null }] },
      [`PUT ${AI_BASE}/profiles/p1`]: { status: 200, body: open },
    });
    const dialog = await editSales(user);
    await user.click(within(dialog).getByRole('button', { name: 'Load tools for server 1' }));
    const tools = await within(dialog).findByRole('group', { name: 'Server 1 allowed tools' });
    expect(within(tools).getByRole('checkbox', { name: 'All tools' })).toBeChecked();
    await user.click(within(tools).getByRole('checkbox', { name: 'book' }));
    expect(within(tools).getByRole('checkbox', { name: 'All tools' })).not.toBeChecked();
    await user.click(within(tools).getByRole('checkbox', { name: 'book' }));
    expect(within(tools).getByRole('checkbox', { name: 'All tools' })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, `PUT ${AI_BASE}/profiles/p1`)?.body).toMatchObject({
        mcpServers: [{ allowedTools: [] }],
      }),
    );
  });

  it('keptToolNamesNotOnTheServerAreListed', async () => {
    const user = userEvent.setup();
    await openProfiles({
      [`POST ${AI_BASE}/profiles/p1/mcp/s1/tools`]: { status: 200, body: [{ name: 'cancel', description: null }] },
    });
    const dialog = await editSales(user);
    await user.click(within(dialog).getByRole('button', { name: 'Load tools for server 1' }));
    const tools = await within(dialog).findByRole('group', { name: 'Server 1 allowed tools' });
    const kept = within(tools).getByRole('checkbox', { name: 'book (not on the server)' });
    expect(kept).toBeChecked();
    await user.click(kept);
    expect(within(tools).queryByRole('checkbox', { name: 'book (not on the server)' })).toBeNull();
  });

  it('failedLoadToolsShowsTheServerMessage', async () => {
    const user = userEvent.setup();
    await openProfiles({
      [`POST ${AI_BASE}/profiles/p1/mcp/s1/tools`]: {
        status: 502,
        body: { code: 'mcp_error', message: 'The MCP server did not answer in time' },
      },
    });
    const dialog = await editSales(user);
    await user.click(within(dialog).getByRole('button', { name: 'Load tools for server 1' }));
    expect(await within(dialog).findByText('The MCP server did not answer in time')).toBeVisible();
  });
});
