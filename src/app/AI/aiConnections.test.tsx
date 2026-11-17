import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CurrentUser } from '@app/api/users';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { AI_BASE, CONNECTION, PROVIDERS, aiRoutes } from '../../test/ai';

const VIEWER: CurrentUser = {
  ...WORKSPACE_MANAGER,
  workspaces: [{ ...BRAND_A, role: { id: 'r-av', name: 'AI_VIEWER' }, authorities: ['ai:view'] }],
};

const INVALID = {
  ...CONNECTION,
  id: 'k9',
  name: 'Old key',
  status: 'INVALID' as const,
  lastError: 'The provider refused the key',
};

async function openPage(user: CurrentUser = WORKSPACE_MANAGER, extra = {}) {
  const fetch = mockFetch({ ...meAs(user), ...aiRoutes(), ...extra });
  renderApp('/ai');
  await screen.findByRole('heading', { name: 'AI' });
  await screen.findByText('Main key');
  return fetch;
}

describe('AI page — connections', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsConnectionsWithStatus', async () => {
    await openPage(WORKSPACE_MANAGER, {
      [`GET ${AI_BASE}/connections`]: { status: 200, body: [CONNECTION, INVALID] },
    });
    const main = screen.getByRole('row', { name: /Main key/ });
    expect(within(main).getByText('OpenAI')).toBeVisible();
    expect(within(main).getByText('sk-…a91F')).toBeVisible();
    expect(within(main).getByText('Verified')).toBeVisible();
    expect(within(screen.getByRole('row', { name: /Old key/ })).getByText('Key refused')).toBeVisible();
  });

  it('createSendsKeyOnceAndClearsIt', async () => {
    const user = userEvent.setup();
    const fetch = await openPage(WORKSPACE_MANAGER, {
      [`POST ${AI_BASE}/connections`]: { status: 201, body: { ...CONNECTION, id: 'k3', name: 'Second key' } },
    });
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    await user.selectOptions(within(dialog).getByLabelText('Provider'), 'openai');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Second key');
    const key = within(dialog).getByLabelText(/^API key/);
    expect(key).toHaveAttribute('type', 'password');
    expect(key).toHaveAttribute('autocomplete', 'new-password');
    await user.type(key, 'sk-secret-123');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(fetch, `POST ${AI_BASE}/connections`)?.body).toEqual({
      name: 'Second key',
      provider: 'openai',
      apiKey: 'sk-secret-123',
      settings: {},
    });
    expect(document.body.textContent).not.toContain('sk-secret-123');
  });

  it('editNameOnlyOmitsKey', async () => {
    const user = userEvent.setup();
    const fetch = await openPage(WORKSPACE_MANAGER, {
      [`PUT ${AI_BASE}/connections/k1`]: { status: 200, body: { ...CONNECTION, name: 'Renamed' } },
    });
    await user.click(screen.getByRole('button', { name: 'Edit Main key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit connection' });
    expect(within(dialog).getByText(/sk-…a91F/)).toBeVisible();
    expect(within(dialog).queryByLabelText(/^API key/)).toBeNull();
    const name = within(dialog).getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, `PUT ${AI_BASE}/connections/k1`)).toBeDefined());
    const body = requestTo(fetch, `PUT ${AI_BASE}/connections/k1`)?.body;
    expect(body).toEqual({ name: 'Renamed', provider: 'openai', settings: {}, version: 0 });
    expect(body).not.toHaveProperty('apiKey');
  });

  it('replaceKeySendsNewKey', async () => {
    const user = userEvent.setup();
    const fetch = await openPage(WORKSPACE_MANAGER, {
      [`PUT ${AI_BASE}/connections/k1`]: { status: 200, body: CONNECTION },
    });
    await user.click(screen.getByRole('button', { name: 'Edit Main key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit connection' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace key' }));
    await user.type(within(dialog).getByLabelText(/^API key/), 'sk-new-456');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, `PUT ${AI_BASE}/connections/k1`)?.body).toEqual({
        name: 'Main key',
        provider: 'openai',
        apiKey: 'sk-new-456',
        settings: {},
        version: 0,
      }),
    );
  });

  it('verifyShowsProviderMessage', async () => {
    const user = userEvent.setup();
    await openPage(WORKSPACE_MANAGER, {
      [`POST ${AI_BASE}/connections/k1/verify`]: {
        status: 200,
        body: { ...CONNECTION, status: 'INVALID', lastError: 'The provider refused the key' },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Verify Main key' }));
    expect(await screen.findByText('The provider refused the key')).toBeVisible();
    expect(within(screen.getByRole('row', { name: /Main key/ })).getByText('Key refused')).toBeVisible();
  });

  it('secretsUnavailableOnKeyField', async () => {
    const user = userEvent.setup();
    await openPage(WORKSPACE_MANAGER, {
      [`POST ${AI_BASE}/connections`]: {
        status: 503,
        body: {
          code: 'secrets_unavailable',
          message: 'Secrets cannot be saved: the server has no encryption key configured',
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    await user.type(within(dialog).getByLabelText(/^Name/), 'X');
    await user.type(within(dialog).getByLabelText(/^API key/), 'sk-x');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    const msg = await within(dialog).findByText('Secrets cannot be saved: the server has no encryption key configured');
    expect(msg.closest('.pf-v6-c-form__group')).toContainElement(within(dialog).getByLabelText(/^API key/));
  });

  it('deleteInUseShowsNames', async () => {
    const user = userEvent.setup();
    await openPage(WORKSPACE_MANAGER, {
      [`DELETE ${AI_BASE}/connections/k1`]: {
        status: 409,
        body: { code: 'ai_connection_in_use', message: 'Used by profiles: Sales assistant' },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Delete Main key' }));
    const dialog = await screen.findByRole('dialog', { name: /Delete connection\?/ });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText('Used by profiles: Sales assistant')).toBeVisible();
  });

  it('viewerWithoutManageSeesNoButtons', async () => {
    await openPage(VIEWER);
    expect(screen.queryByRole('button', { name: 'Add connection' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Main key' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Main key' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verify Main key' })).toBeNull();
  });

  it('storedResponsesNote', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    await user.selectOptions(within(dialog).getByLabelText('Provider'), 'openai');
    expect(within(dialog).getByText('OpenAI keeps stored responses for 30 days in your OpenAI account.')).toBeVisible();
  });

  it('showsTheSelectedProvidersFields', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    expect(within(dialog).getByLabelText('Organization ID')).toBeVisible();
    expect(within(dialog).getByLabelText('Project ID')).toBeVisible();
    expect(
      within(dialog).getByText('Optional. Sent as OpenAI-Organization. Not a secret; the key goes in API key.'),
    ).toBeVisible();
    await user.selectOptions(within(dialog).getByLabelText('Provider'), 'scripted');
    expect(within(dialog).queryByLabelText('Organization ID')).toBeNull();
    expect(within(dialog).queryByLabelText('Project ID')).toBeNull();
  });

  it('sendsSettingsOnSave', async () => {
    const user = userEvent.setup();
    const fetch = await openPage(WORKSPACE_MANAGER, {
      [`POST ${AI_BASE}/connections`]: { status: 201, body: { ...CONNECTION, id: 'k3', name: 'Second key' } },
    });
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    await user.type(within(dialog).getByLabelText(/^Name/), 'Second key');
    await user.type(within(dialog).getByLabelText(/^API key/), 'sk-secret-123');
    await user.type(within(dialog).getByLabelText('Organization ID'), ' org_1 ');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(fetch, `POST ${AI_BASE}/connections`)?.body).toMatchObject({
      settings: { organization: 'org_1' },
    });
  });

  it('settingsOfAnotherProviderAreNotSent', async () => {
    const user = userEvent.setup();
    const fetch = await openPage(WORKSPACE_MANAGER, {
      [`POST ${AI_BASE}/connections`]: { status: 201, body: { ...CONNECTION, id: 'k3', name: 'Second key' } },
    });
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    await user.type(within(dialog).getByLabelText('Organization ID'), 'org_1');
    await user.selectOptions(within(dialog).getByLabelText('Provider'), 'scripted');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Second key');
    await user.type(within(dialog).getByLabelText(/^API key/), 'good');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(fetch, `POST ${AI_BASE}/connections`)?.body).toMatchObject({ provider: 'scripted', settings: {} });
  });

  it('showsStoredSettingsOnEditAndCanClearOne', async () => {
    const user = userEvent.setup();
    const stored = { ...CONNECTION, settings: { project: 'p1' } };
    const fetch = await openPage(WORKSPACE_MANAGER, {
      [`GET ${AI_BASE}/connections`]: { status: 200, body: [stored] },
      [`PUT ${AI_BASE}/connections/k1`]: { status: 200, body: CONNECTION },
    });
    await user.click(screen.getByRole('button', { name: 'Edit Main key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit connection' });
    const project = within(dialog).getByLabelText('Project ID');
    expect(project).toHaveValue('p1');
    expect(project).toHaveAttribute('type', 'text');
    await user.clear(project);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, `PUT ${AI_BASE}/connections/k1`)).toBeDefined());
    expect(requestTo(fetch, `PUT ${AI_BASE}/connections/k1`)?.body).toEqual({
      name: 'Main key',
      provider: 'openai',
      settings: {},
      version: 0,
    });
  });

  it('showsASettingsFieldErrorUnderItsInput', async () => {
    const user = userEvent.setup();
    await openPage(WORKSPACE_MANAGER, {
      [`PUT ${AI_BASE}/connections/k1`]: {
        status: 400,
        body: {
          code: 'VALIDATION',
          message: 'Validation failed',
          fields: { 'settings.organization': 'must not contain control characters' },
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Edit Main key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit connection' });
    await user.type(within(dialog).getByLabelText('Organization ID'), 'org_1');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('must not contain control characters')).toBeVisible();
  });

  it('marksARequiredField', async () => {
    const user = userEvent.setup();
    const providers = [
      {
        ...PROVIDERS[1],
        connectionFields: [{ key: 'region', label: 'Region', help: 'Where it runs.', kind: 'TEXT', required: true }],
      },
    ];
    await openPage(WORKSPACE_MANAGER, { [`GET ${AI_BASE}/providers`]: { status: 200, body: providers } });
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    await user.type(within(dialog).getByLabelText(/^Name/), 'Cloud');
    const region = within(dialog).getByLabelText(/^Region/);
    expect(region).toBeRequired();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    // a disabled Save says what it is waiting for
    expect(within(dialog).getByText('Fill in Region to save.')).toBeVisible();
    await user.type(region, 'eu');
    expect(within(dialog).getByRole('button', { name: 'Save' })).not.toBeDisabled();
    expect(within(dialog).queryByText('Fill in Region to save.')).toBeNull();
  });
});
