import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { attribute, contact, savedFilter } from '../../test/contacts';
import { content, placeholderView, template } from '../../test/templates';
import { cloudSender, sender } from '../../test/campaigns';
import { cloudTemplate } from '../../test/cloudTemplates';

const B = '/api/workspaces/w1';
const C = `${B}/campaigns`;
const SENDERS = `GET ${C}/senders`;
const CLOUD_SENDERS = `GET ${C}/senders?channel=WHATSAPP_CLOUD_API`;

const WELCOME = template({
  id: 't1',
  name: 'Welcome',
  content: content({ body: 'Hello {{contact.name}}' }),
  placeholders: [placeholderView({ name: 'contact.name', kind: 'CONTACT_FIELD' })],
});
const P1 = sender({ phoneNumberId: 'p1', number: '919800000001', state: 'WARMING', capToday: 5 });
const CP1 = cloudSender({ usedLast24h: 12 });
const FOLLOW_UP = cloudTemplate({ id: 'ct1', name: 'course_follow_up' });

export function cloudRoutes(extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${B}/contact-filters`]: { status: 200, body: [savedFilter({ id: 'f1', name: 'Pune leads' })] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [attribute({ id: 'a1', name: 'City' })] },
    [`POST ${B}/contacts/count`]: { status: 200, body: { count: 300 } },
    [`POST ${B}/contacts/search`]: {
      status: 200,
      body: { items: [contact({ id: 'c1', name: 'Asha', phone: '919900000001' })], total: 1, page: 0 },
    },
    [`GET ${B}/templates`]: { status: 200, body: [WELCOME] },
    [SENDERS]: { status: 200, body: [P1] },
    [CLOUD_SENDERS]: { status: 200, body: [CP1] },
    [`GET ${B}/cloud-templates`]: { status: 200, body: [FOLLOW_UP] },
    ...extra,
  };
}

type User = ReturnType<typeof renderApp>['user'];
const next = () => screen.getByRole('button', { name: 'Next' });

export async function throughAudience(user: User) {
  const name = await screen.findByRole('textbox', { name: 'Name' });
  await user.type(name, 'Spring intake');
  const select = await screen.findByRole('combobox', { name: 'Saved contact filter' });
  await within(select).findByRole('option', { name: 'Pune leads' });
  await user.selectOptions(select, 'Pune leads');
  await screen.findByText('300 contacts');
  await user.click(next());
}

export async function chooseCloud(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Cloud API numbers' }));
}

describe('new campaign wizard: the kind of number', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('numbersStepComesBeforeMessage', async () => {
    mockFetch(cloudRoutes());
    renderApp('/campaigns/new');
    await screen.findByRole('textbox', { name: 'Name' });
    const steps = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.trim())
      .filter((t) => t === 'Audience' || t === 'Senders' || t === 'Message' || t === 'Review');
    expect(steps).toEqual(['Audience', 'Senders', 'Message', 'Review']);
  });

  it('cloudKindListsCloudNumbers', async () => {
    mockFetch(cloudRoutes());
    const { user } = renderApp('/campaigns/new');
    await throughAudience(user);
    await chooseCloud(user);
    const row = await screen.findByRole('row', { name: /Admissions/ });
    expect(within(row).getByText('GREEN')).toBeVisible();
    expect(within(row).getByText('250 a day')).toBeVisible();
    expect(within(row).getByText('12 used in the last 24 hours')).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: 'Select +919800000001' })).not.toBeInTheDocument();
  });

  it('atLimitNumberIsSelectableWithNote', async () => {
    mockFetch(cloudRoutes({ [CLOUD_SENDERS]: { status: 200, body: [cloudSender({ usedLast24h: 250 })] } }));
    const { user } = renderApp('/campaigns/new');
    await throughAudience(user);
    await chooseCloud(user);
    const box = await screen.findByRole('checkbox', { name: 'Select Admissions' });
    expect(box).toBeEnabled();
    expect(screen.getByText('Limit reached — goes on as the 24 hours roll')).toBeVisible();
    await user.click(box);
    expect(next()).toBeEnabled();
  });

  it('twoWabasBlocked', async () => {
    mockFetch(
      cloudRoutes({
        [CLOUD_SENDERS]: {
          status: 200,
          body: [CP1, cloudSender({ phoneNumberId: 'cp2', label: 'Second', number: '919876543211', wabaId: '999' })],
        },
      }),
    );
    const { user } = renderApp('/campaigns/new');
    await throughAudience(user);
    await chooseCloud(user);
    await user.click(await screen.findByRole('checkbox', { name: 'Select Admissions' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Second' }));
    expect(next()).toBeDisabled();
    expect(screen.getByText('Choose numbers of one WhatsApp account')).toBeVisible();
  });

  it('cannotSendRowDisabled', async () => {
    mockFetch(cloudRoutes({ [CLOUD_SENDERS]: { status: 200, body: [cloudSender({ canSend: false })] } }));
    const { user } = renderApp('/campaigns/new');
    await throughAudience(user);
    await chooseCloud(user);
    expect(await screen.findByRole('checkbox', { name: 'Select Admissions' })).toBeDisabled();
    expect(screen.getByText('Not ready to send')).toBeVisible();
  });

  it('switchingKindClearsChoices', async () => {
    mockFetch(cloudRoutes());
    const { user } = renderApp('/campaigns/new');
    await throughAudience(user);
    await user.click(await screen.findByRole('checkbox', { name: 'Select +919800000001' }));
    await chooseCloud(user);
    await user.click(screen.getByRole('button', { name: 'WhatsApp Web numbers' }));
    expect(await screen.findByRole('checkbox', { name: 'Select +919800000001' })).not.toBeChecked();
    expect(next()).toBeDisabled();
  });
});
