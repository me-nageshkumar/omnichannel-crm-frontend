import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCloudTemplates, saveCloudTemplateFills, syncCloudTemplates } from '@app/api/cloudTemplates';
import { sendCloudTemplate } from '@app/api/inbox';
import { addCloudNumber, registerCloudNumber } from '@app/api/phoneNumbers';
import { mockFetch, requestTo } from '../../test/fetchMock';

describe('cloud templates api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('listBuildsQuery', async () => {
    const fetch = mockFetch({ 'GET /api/workspaces/w1/meta/templates': { status: 200, body: [] } });

    await listCloudTemplates('tok', 'w1', { phoneNumberId: 'p1', sendable: true });

    const url = String(fetch.mock.calls[0][0]);
    expect(url).toContain('phoneNumberId=p1');
    expect(url).toContain('sendable=true');
  });

  it('syncAndFills', async () => {
    const fetch = mockFetch({
      'POST /api/workspaces/w1/meta/templates/sync': { status: 200, body: { added: 1, updated: 0, removed: 0 } },
      'PUT /api/workspaces/w1/meta/templates/t1/fills': { status: 200, body: {} },
    });

    expect(await syncCloudTemplates('tok', 'w1')).toEqual({ added: 1, updated: 0, removed: 0 });
    await saveCloudTemplateFills('tok', 'w1', 't1', { 'body:1': { kind: 'CONTACT_FIELD', attributeKey: 'name' } });
    expect(requestTo(fetch, 'PUT /api/workspaces/w1/meta/templates/t1/fills')?.body).toEqual({
      fills: { 'body:1': { kind: 'CONTACT_FIELD', attributeKey: 'name' } },
    });
  });

  it('sendCloudTemplatePostsToCloudTemplates', async () => {
    const fetch = mockFetch({ 'POST /api/workspaces/w1/inbox/chats/c1/cloud-templates': { status: 200, body: {} } });

    await sendCloudTemplate('tok', 'w1', 'c1', { cloudTemplateId: 't1', values: { 'body:1': 'Veenu' } });

    expect(requestTo(fetch, 'POST /api/workspaces/w1/inbox/chats/c1/cloud-templates')?.body).toEqual({
      cloudTemplateId: 't1',
      values: { 'body:1': 'Veenu' },
    });
  });

  it('cloudNumberCalls', async () => {
    const fetch = mockFetch({
      'POST /api/workspaces/w1/phone-numbers': { status: 201, body: {} },
      'POST /api/workspaces/w1/phone-numbers/p1/cloud/register': { status: 200, body: {} },
    });

    await addCloudNumber('tok', 'w1', {
      label: 'Admissions',
      cloud: { connectionId: 'c1', wabaId: '222', metaPhoneNumberId: '333' },
    });
    await registerCloudNumber('tok', 'w1', 'p1', '123456');

    expect(requestTo(fetch, 'POST /api/workspaces/w1/phone-numbers')?.body).toEqual({
      label: 'Admissions',
      connectionType: 'WHATSAPP_CLOUD_API',
      cloud: { connectionId: 'c1', wabaId: '222', metaPhoneNumberId: '333' },
    });
    expect(requestTo(fetch, 'POST /api/workspaces/w1/phone-numbers/p1/cloud/register')?.body).toEqual({
      pin: '123456',
    });
  });
});
