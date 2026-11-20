import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { attribute, contact, savedFilter } from '../../test/contacts';
import { content, placeholderView, template } from '../../test/templates';
import { campaign, campaignDetail, campaignSettings, cloudSender, recipient, sender } from '../../test/campaigns';
import { cloudTemplate } from '../../test/cloudTemplates';
import { EMPTY_DRAFT, cloudPlaceholders, toRequest } from '@app/Campaigns/NewCampaign/draft';

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
const BROCHURE = cloudTemplate({
  id: 'ct4',
  name: 'brochure',
  header: { format: 'IMAGE' },
  components: [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Our brochure' },
  ],
  variables: [],
});

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
    [`GET ${B}/meta/templates`]: {
      status: 200,
      body: [
        FOLLOW_UP,
        cloudTemplate({ id: 'ct2', name: 'fees_reminder', status: 'PENDING', sendable: false }),
        cloudTemplate({
          id: 'ct3',
          name: 'courses',
          supported: false,
          sendable: false,
          unsupportedReason: 'Carousel templates are not supported yet',
        }),
        BROCHURE,
      ],
    },
    [`POST ${B}/channel-accounts/cp1/media`]: { status: 200, body: { id: 'm1' } },
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

async function toCloudMessage(user: User) {
  await throughAudience(user);
  await chooseCloud(user);
  await user.click(await screen.findByRole('checkbox', { name: 'Select Admissions' }));
  await user.click(next());
}

describe('new campaign wizard: the WhatsApp template of a Cloud campaign', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('cloudShowsWhatsAppTemplates', async () => {
    mockFetch(cloudRoutes());
    const { user } = renderApp('/campaigns/new');
    await toCloudMessage(user);
    expect(await screen.findByRole('radio', { name: /course_follow_up/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /fees_reminder/ })).toBeDisabled();
    expect(screen.getByText("Waiting for Meta's approval")).toBeVisible();
    expect(screen.getByRole('radio', { name: /courses/ })).toBeDisabled();
    expect(screen.getByText('Carousel templates are not supported yet')).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: /^Welcome/ })).not.toBeInTheDocument();
  });

  it('cloudVariablesAreMapped', async () => {
    mockFetch(cloudRoutes());
    const { user } = renderApp('/campaigns/new');
    await toCloudMessage(user);
    await user.click(await screen.findByRole('radio', { name: /course_follow_up/ }));
    expect(await screen.findByRole('combobox', { name: 'Source for body:1' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Source for body:2' })).toBeVisible();
    expect(screen.getByLabelText('Preview of course_follow_up')).toBeVisible();
  });

  it('mediaHeaderNeedsAFile', async () => {
    const fetch = mockFetch(cloudRoutes());
    const { user } = renderApp('/campaigns/new');
    await toCloudMessage(user);
    await user.click(await screen.findByRole('radio', { name: /brochure/ }));
    expect(screen.getByText('Choose the header image')).toBeVisible();
    expect(next()).toBeDisabled();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([new Uint8Array([1, 2, 3])], 'brochure.png', { type: 'image/png' }));
    expect(await screen.findByText('brochure.png')).toBeVisible();
    expect(next()).toBeEnabled();
    expect(fetch.mock.calls.some(([u]) => String(u).includes('/channel-accounts/cp1/media'))).toBe(true);
  });

  it('cloudRequestShape', () => {
    const d = {
      ...EMPTY_DRAFT,
      name: ' Spring ',
      filterId: 'f1',
      channel: 'WHATSAPP_CLOUD_API' as const,
      senderIds: ['cp1'],
      cloudTemplate: FOLLOW_UP,
      mappings: {
        'body:1': { source: { kind: 'CONTACT_FIELD' as const, field: 'name' as const }, fallback: 'there' },
        'body:2': { source: { kind: 'FIXED' as const, text: 'BCA' }, fallback: '' },
      },
    };
    expect(toRequest(d, cloudPlaceholders(FOLLOW_UP))).toEqual({
      name: 'Spring',
      audience: { kind: 'FILTER', filterId: 'f1' },
      channel: 'WHATSAPP_CLOUD_API',
      templateIds: [],
      cloudTemplate: { cloudTemplateId: 'ct1', headerMediaId: null },
      placeholders: [
        { name: 'body:1', source: { kind: 'CONTACT_FIELD', field: 'name' }, fallback: 'there' },
        { name: 'body:2', source: { kind: 'FIXED', text: 'BCA' }, fallback: '' },
      ],
      senderIds: ['cp1'],
    });
  });

  it('webRequestUnchanged', () => {
    const d = { ...EMPTY_DRAFT, name: 'Diwali', filterId: 'f1', templates: [WELCOME], senderIds: ['p1'] };
    expect(toRequest(d, [])).toEqual({
      name: 'Diwali',
      audience: { kind: 'FILTER', filterId: 'f1' },
      templateIds: ['t1'],
      placeholders: [],
      senderIds: ['p1'],
    });
  });
});

const CLOUD_CAMPAIGN = campaignDetail({
  id: 'c1',
  name: 'Spring intake',
  channel: 'WHATSAPP_CLOUD_API',
  senderIds: ['cp1'],
  senders: [],
  templateIds: [],
  templateNames: [],
  cloudTemplate: { cloudTemplateId: 'ct1', name: 'course_follow_up', language: 'en', status: 'APPROVED', headerMediaId: null },
  cloudSenders: [cloudSender({ usedLast24h: 120 })],
});

describe('Cloud campaigns: review, list, detail and settings', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reviewShowsCloudNote', async () => {
    mockFetch(cloudRoutes());
    const { user } = renderApp('/campaigns/new');
    await toCloudMessage(user);
    await user.click(await screen.findByRole('radio', { name: /course_follow_up/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Source for body:1' }), 'Contact name');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Source for body:2' }), 'Contact name');
    await user.click(next());
    expect(await screen.findByText('course_follow_up (en)')).toBeVisible();
    expect(screen.getByText(/About 2 working days/)).toBeVisible();
    expect(
      screen.getByText(
        'Meta charges for every message sent, and may hold back marketing messages to people who received many recently.',
      ),
    ).toBeVisible();
  });

  it('listShowsKindAndNewPauseReasons', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${C}`]: {
        status: 200,
        body: {
          items: [
            campaign({
              id: 'c1',
              name: 'Spring intake',
              channel: 'WHATSAPP_CLOUD_API',
              status: 'PAUSED',
              pausedBy: 'SYSTEM',
              pauseReason: 'TEMPLATE_UNAVAILABLE',
            }),
          ],
          total: 1,
          page: 0,
          systemPaused: true,
        },
      },
    });
    renderApp('/campaigns');
    const row = await screen.findByRole('row', { name: /Spring intake/ });
    expect(within(row).getByText('Cloud API')).toBeVisible();
  });

  it('detailShowsTemplateAndCloudNumbers', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${C}/c1`]: {
        status: 200,
        body: {
          ...CLOUD_CAMPAIGN,
          status: 'PAUSED',
          pausedBy: 'SYSTEM',
          pauseReason: 'TEMPLATE_UNAVAILABLE',
          cloudSenders: [cloudSender({ usedLast24h: 120, heldUntil: '2026-11-21T08:35:00Z' })],
        },
      },
      [`GET ${C}/c1/recipients`]: {
        status: 200,
        body: { items: [recipient({ status: 'FAILED', error: '131026 Message undeliverable' })], total: 1, page: 0 },
      },
    });
    renderApp('/campaigns/c1');
    expect(await screen.findByText('WhatsApp template: course_follow_up (en)')).toBeVisible();
    expect(screen.getByText('Meta paused or rejected the WhatsApp template')).toBeVisible();
    const row = screen.getByRole('row', { name: /Admissions/ });
    expect(within(row).getByText('used 120 of 250 in the last 24 hours')).toBeVisible();
    expect(within(row).getByText(/^Waiting for Meta's daily limit until/)).toBeVisible();
    expect(await screen.findByText('131026 Message undeliverable')).toBeVisible();
    expect(screen.queryByLabelText('Senders today')).not.toBeInTheDocument();
  });

  it('missingChannelReadsAsWeb', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${C}/c1`]: { status: 200, body: campaignDetail({ id: 'c1', name: 'Diwali' }) },
      [`GET ${C}/c1/recipients`]: { status: 200, body: { items: [], total: 0, page: 0 } },
    });
    renderApp('/campaigns/c1');
    expect(await screen.findByLabelText('Senders today')).toBeVisible();
    expect(screen.queryByText(/^WhatsApp template:/)).not.toBeInTheDocument();
  });

  it('settingsSaysWhatAppliesToWhom', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${C}/settings`]: { status: 200, body: campaignSettings() },
    });
    renderApp('/campaigns/settings');
    expect(
      await screen.findByText(
        'Warm-up, gaps and caps apply to WhatsApp Web numbers. Working days and hours apply to both.',
      ),
    ).toBeVisible();
  });
});
