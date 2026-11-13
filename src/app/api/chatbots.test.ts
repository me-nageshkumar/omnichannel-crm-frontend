import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CloudMessage,
  getRun,
  listRuns,
  previewChatbotMessage,
  saveChatbot,
  startChatbotTest,
  uploadChatbotMedia,
} from '@app/api/chatbots';
import { stopChatbot } from '@app/api/inbox';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { LEAD_QUALIFIER } from '../../test/chatbots';

describe('chatbots api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saveSendsFlowAndVersion', async () => {
    const fetch = mockFetch({
      'PUT /api/workspaces/w1/chatbots/c1': { status: 200, body: { chatbot: LEAD_QUALIFIER, problems: [] } },
    });
    const body = { flow: LEAD_QUALIFIER.flow, settings: LEAD_QUALIFIER.settings, version: 3 };
    const res = await saveChatbot('tok', 'w1', 'c1', body);
    expect(res.problems).toEqual([]);
    const req = requestTo(fetch, 'PUT /api/workspaces/w1/chatbots/c1');
    expect(req?.body).toEqual(body);
    expect(req?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('startTestPostsContactAndNumber', async () => {
    const fetch = mockFetch({
      'POST /api/workspaces/w1/chatbots/c1/test': { status: 201, body: { id: 'r1', status: 'RUNNING' } },
    });
    const run = await startChatbotTest('tok', 'w1', 'c1', { contactId: 'k1', phoneNumberId: 'n1' });
    expect(run.id).toBe('r1');
    expect(requestTo(fetch, 'POST /api/workspaces/w1/chatbots/c1/test')?.body).toEqual({
      contactId: 'k1',
      phoneNumberId: 'n1',
    });
  });

  it('listRunsBuildsQuery', async () => {
    const fetch = mockFetch({
      'GET /api/workspaces/w1/chatbots/c1/runs': { status: 200, body: { items: [], total: 0 } },
      'GET /api/workspaces/w1/chatbots/c1/runs/r1': { status: 200, body: { id: 'r1' } },
    });
    const page = await listRuns('tok', 'w1', 'c1', { status: 'WAITING', page: 0, size: 25 });
    expect(page.total).toBe(0);
    expect(String(fetch.mock.calls[0][0])).toBe('/api/workspaces/w1/chatbots/c1/runs?status=WAITING&page=0&size=25');
    expect((await getRun('tok', 'w1', 'c1', 'r1')).id).toBe('r1');
  });

  it('uploadIsMultipart', async () => {
    const fetch = mockFetch({ 'POST /api/workspaces/w1/chatbots/c1/media': { status: 200, body: { id: 'img1' } } });
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    const res = await uploadChatbotMedia('tok', 'w1', 'c1', 'image', file);
    expect(res.id).toBe('img1');
    const body = fetch.mock.calls[0][1]?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('type')).toBe('image');
    expect((body.get('file') as File).name).toBe('a.png');
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('previewReturnsHtml', async () => {
    const message: CloudMessage = { messaging_product: 'whatsapp-web', type: 'text', text: { body: 'Hi' } };
    const fetch = mockFetch({
      'POST /api/workspaces/w1/chatbots/c1/preview': new Response('<html>Hi</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    });
    expect(await previewChatbotMessage('tok', 'w1', 'c1', message)).toBe('<html>Hi</html>');
    expect(requestTo(fetch, 'POST /api/workspaces/w1/chatbots/c1/preview')?.body).toEqual(message);
  });

  it('stopChatbotPostsToInbox', async () => {
    const fetch = mockFetch({ 'POST /api/workspaces/w1/inbox/chats/ch1/chatbot/stop': { status: 204 } });
    await stopChatbot('tok', 'w1', 'ch1');
    expect(requestTo(fetch, 'POST /api/workspaces/w1/inbox/chats/ch1/chatbot/stop')).toBeTruthy();
  });
});
