import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBrandChatbotSettings,
  getPlatformChatbotSettings,
  saveBrandChatbotSettings,
  savePlatformChatbotSettings,
} from '@app/api/chatbots';
import { EMPTY_LAYER } from '@app/Chatbots/settings/settingsLayers';
import { mockFetch, requestTo } from '../../test/fetchMock';

describe('chatbot settings api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('apiPathsAndBodies', async () => {
    const own = { ...EMPTY_LAYER, endAfterMinutes: 60 };
    const fetch = mockFetch({
      'GET /api/platform/chatbot-settings': {
        status: 200,
        body: { settings: own, version: null, lastUpdateTime: null, updatedBy: null },
      },
      'PUT /api/platform/chatbot-settings': {
        status: 200,
        body: { settings: own, version: 0, lastUpdateTime: null, updatedBy: 'u1' },
      },
      'GET /api/workspaces/w1/chatbots/settings': { status: 200, body: { own, inherited: own, version: 1 } },
      'PUT /api/workspaces/w1/chatbots/settings': { status: 200, body: { own, inherited: own, version: 2 } },
    });

    expect((await getPlatformChatbotSettings('tok')).version).toBeNull();
    await savePlatformChatbotSettings('tok', { settings: own, version: null });
    expect((await getBrandChatbotSettings('tok', 'w1')).version).toBe(1);
    await saveBrandChatbotSettings('tok', 'w1', { own, version: 1 });

    expect(requestTo(fetch, 'PUT /api/platform/chatbot-settings')?.body).toEqual({ settings: own, version: null });
    expect(requestTo(fetch, 'PUT /api/workspaces/w1/chatbots/settings')?.body).toEqual({ own, version: 1 });
    expect(requestTo(fetch, 'GET /api/workspaces/w1/chatbots/settings')?.headers.get('Authorization')).toBe(
      'Bearer tok',
    );
  });
});
