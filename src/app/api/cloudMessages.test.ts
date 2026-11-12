import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '@app/api/client';
import { CloudMessage, previewCloudMessage, sendCloudMessage, uploadCloudMedia } from '@app/api/cloudMessages';
import { mockFetch, rejectionOf, requestTo } from '../../test/fetchMock';

const BUTTON: CloudMessage = {
  messaging_product: 'whatsapp-web',
  recipient_type: 'individual',
  type: 'interactive',
  interactive: {
    type: 'button',
    body: { text: 'Hi' },
    action: { buttons: [{ type: 'reply', reply: { id: 'yes', title: 'Yes' } }] },
  },
};

describe('cloud messages api', () => {
  afterEach(() => {
    // vi.unstubAllGlobals is called by mockFetch's callers in other suites; keep this suite self-contained
  });

  it('sends a cloud message to the chat route with the bearer', async () => {
    const fetch = mockFetch({
      'POST /api/workspaces/w1/inbox/chats/c1/cloud-messages': {
        status: 200,
        body: { messaging_product: 'whatsapp-web', contacts: [{ input: '91', wa_id: '91' }], messages: [{ id: 'm9' }] },
      },
    });
    const res = await sendCloudMessage('tok', 'w1', 'c1', BUTTON);
    expect(res.messages[0].id).toBe('m9');
    const req = requestTo(fetch, 'POST /api/workspaces/w1/inbox/chats/c1/cloud-messages');
    expect(req?.body).toEqual(BUTTON);
    expect(req?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('uploads media as multipart with product and type', async () => {
    const fetch = mockFetch({
      'POST /api/workspaces/w1/channel-accounts/p1/media': { status: 200, body: { id: 'img1' } },
    });
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    const res = await uploadCloudMedia('tok', 'w1', 'p1', 'image', file);
    expect(res.id).toBe('img1');
    const body = fetch.mock.calls[0][1]?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('messaging_product')).toBe('whatsapp-web');
    expect(body.get('type')).toBe('image');
    expect((body.get('file') as File).name).toBe('a.png');
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('returns the preview html as text', async () => {
    const fetch = mockFetch({
      'POST /api/workspaces/w1/channel-accounts/p1/messages/preview': {
        status: 200,
        text: '<!doctype html><p>ok</p>',
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      },
    });
    const html = await previewCloudMessage('tok', 'w1', 'p1', BUTTON);
    expect(html).toBe('<!doctype html><p>ok</p>');
    expect(requestTo(fetch, 'POST /api/workspaces/w1/channel-accounts/p1/messages/preview')?.body).toEqual(BUTTON);
  });

  it('rejects with ApiError carrying fields', async () => {
    mockFetch({
      'POST /api/workspaces/w1/inbox/chats/c1/cloud-messages': {
        status: 400,
        body: { code: 'VALIDATION', message: 'x', fields: { 'interactive.body.text': 'is required' } },
      },
    });
    const e = await rejectionOf<ApiError>(sendCloudMessage('tok', 'w1', 'c1', BUTTON));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.fields).toEqual({ 'interactive.body.text': 'is required' });
  });
});
