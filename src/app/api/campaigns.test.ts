import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  campaignAction,
  createCampaign,
  getCampaignSettings,
  listCampaigns,
  listRecipients,
  listSenders,
  previewCsv,
  sampleCsv,
  updateCampaignSettings,
  updateSender,
} from '@app/api/campaigns';
import type { CampaignRequest } from '@app/api/campaigns';
import { urlsOf } from '../../test/admin';
import { campaign, campaignSettings, partJson, sender } from '../../test/campaigns';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';

const B = '/api/workspaces/w1/campaigns';

afterEach(() => vi.unstubAllGlobals());

const filterReq: CampaignRequest = {
  name: 'Diwali',
  audience: { kind: 'FILTER', filterId: 'f1' },
  templateIds: ['t1'],
  placeholders: [{ name: 'name', source: { kind: 'CONTACT_FIELD', field: 'name' }, fallback: 'there' }],
  senderIds: ['p1'],
};

describe('campaigns api', () => {
  it('listsWithPageAndStatus', async () => {
    const fetch = mockFetch({ [`GET ${B}`]: { status: 200, body: { items: [], total: 0, page: 0, systemPaused: false } } });
    await listCampaigns('t', 'w1', { page: 0 });
    await listCampaigns('t', 'w1', { status: 'RUNNING', page: 2 });
    expect(urlsOf(fetch, `GET ${B}`)).toEqual([`${B}?page=0`, `${B}?status=RUNNING&page=2`]);
  });

  it('createsAFilterCampaignAsJson', async () => {
    const fetch = mockFetch({ [`POST ${B}`]: { status: 201, body: campaign() } });
    await createCampaign('t', 'w1', filterReq);
    const req = requestTo(fetch, `POST ${B}`);
    expect(req?.body).toEqual(filterReq);
    expect(req?.headers.get('Content-Type')).toBe('application/json');
  });

  it('createsACsvCampaignAsMultipart', async () => {
    const fetch = mockFetch({ [`POST ${B}`]: { status: 201, body: campaign() } });
    const req: CampaignRequest = { ...filterReq, audience: { kind: 'CSV', phoneColumn: 'phone', nameColumn: null } };
    await createCampaign('t', 'w1', req, new File(['phone\n1'], 'leads.csv', { type: 'text/csv' }));
    const form = fetch.mock.calls[0][1]?.body;
    expect(form).toBeInstanceOf(FormData);
    expect(await partJson(form as FormData, 'campaign')).toEqual(req);
    expect(((form as FormData).get('file') as File).name).toBe('leads.csv');
  });

  it('postsLifecycleActions', async () => {
    const fetch = mockFetch({ [`POST ${B}/c1/terminate`]: { status: 200, body: campaign() } });
    await campaignAction('t', 'w1', 'c1', 'terminate');
    expect(callsTo(fetch, `POST ${B}/c1/terminate`)).toBe(1);
  });

  it('listsRecipientsByStatus', async () => {
    const fetch = mockFetch({ [`GET ${B}/c1/recipients`]: { status: 200, body: { items: [], total: 0, page: 0 } } });
    await listRecipients('t', 'w1', 'c1', { status: 'SKIPPED', page: 1 });
    await listRecipients('t', 'w1', 'c1', { page: 0 });
    expect(urlsOf(fetch, `GET ${B}/c1/recipients`)).toEqual([
      `${B}/c1/recipients?status=SKIPPED&page=1`,
      `${B}/c1/recipients?page=0`,
    ]);
  });

  it('previewsACsv', async () => {
    const preview = { headers: ['phone'], sample: [['1']], rows: 1, suggested: { phone: 'phone' } };
    const fetch = mockFetch({ [`POST ${B}/csv/preview`]: { status: 200, body: preview } });
    const out = await previewCsv('t', 'w1', new File(['phone\n1'], 'leads.csv'));
    expect(out).toEqual(preview);
    const form = fetch.mock.calls[0][1]?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('leads.csv');
  });

  it('downloadsASampleCsv', async () => {
    mockFetch({
      [`GET ${B}/templates/t1/sample-csv`]: { status: 200, text: 'phone,first_name\n', headers: { 'Content-Type': 'text/csv' } },
    });
    const blob = await sampleCsv('t', 'w1', 't1');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('listsAndUpdatesASender', async () => {
    const fetch = mockFetch({
      [`GET ${B}/senders`]: { status: 200, body: [sender()] },
      [`PUT ${B}/senders/p1`]: { status: 200, body: sender() },
    });
    expect(await listSenders('t', 'w1')).toHaveLength(1);
    await updateSender('t', 'w1', 'p1', { action: 'REST' });
    expect(requestTo(fetch, `PUT ${B}/senders/p1`)?.body).toEqual({ action: 'REST' });
  });

  it('readsAndSavesSettings', async () => {
    const fetch = mockFetch({
      [`GET ${B}/settings`]: { status: 200, body: campaignSettings() },
      [`PUT ${B}/settings`]: { status: 200, body: campaignSettings({ hourlyCap: 10 }) },
    });
    expect((await getCampaignSettings('t', 'w1')).hourlyCap).toBe(12);
    await updateCampaignSettings('t', 'w1', campaignSettings({ hourlyCap: 10 }));
    expect(requestTo(fetch, `PUT ${B}/settings`)?.body).toEqual(campaignSettings({ hourlyCap: 10 }));
  });
});
