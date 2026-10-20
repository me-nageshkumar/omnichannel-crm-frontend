import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assignChat,
  chatMediaUrl,
  closeChat,
  fetchMedia,
  getAssignees,
  getChat,
  getInboxSettings,
  getThread,
  listChats,
  listInboxNumbers,
  markRead,
  parseSse,
  putInboxSettings,
  reopenChat,
  sendTemplate,
  sendText,
  streamUrl,
  toInboxEvent,
  unassignChat,
} from '@app/api/inbox';
import { mockFetch, requestTo } from '../../test/fetchMock';

const B = '/api/workspaces/w1/inbox';

afterEach(() => vi.unstubAllGlobals());

describe('parseSse', () => {
  it('splits complete frames and keeps the partial tail', () => {
    const out = parseSse('event: chat\ndata: {"a":1}\n\n: ping\n\nevent: message\ndata: {');
    expect(out.events).toEqual([{ event: 'chat', data: '{"a":1}' }]);
    expect(out.rest).toBe('event: message\ndata: {');
  });

  it('joins multi-line data', () => {
    const out = parseSse('event: chat\ndata: line1\ndata: line2\n\n');
    expect(out.events).toEqual([{ event: 'chat', data: 'line1\nline2' }]);
    expect(out.rest).toBe('');
  });

  it('tolerates CRLF line endings', () => {
    const out = parseSse('event: chat\r\ndata: {"a":1}\r\n\r\n: ping\r\n\r\nevent: x\r\ndata: 1');
    expect(out.events).toEqual([{ event: 'chat', data: '{"a":1}' }]);
    expect(out.rest).toBe('event: x\ndata: 1');
  });

  it('defaults the event name to message', () => {
    expect(parseSse('data: hi\n\n').events).toEqual([{ event: 'message', data: 'hi' }]);
  });
});

describe('toInboxEvent', () => {
  it('maps chat, message and action and returns null for unknown or bad data', () => {
    expect(toInboxEvent('chat', '{"chat":{"id":"c1"},"visible":false}')).toEqual({
      type: 'chat',
      chat: { id: 'c1' },
      visible: false,
    });
    expect(toInboxEvent('message', '{"chatId":"c1","message":{"id":"m1"}}')).toEqual({
      type: 'message',
      chatId: 'c1',
      message: { id: 'm1' },
    });
    expect(toInboxEvent('action', '{"chatId":"c1","action":{"id":"a1"}}')).toEqual({
      type: 'action',
      chatId: 'c1',
      action: { id: 'a1' },
    });
    expect(toInboxEvent('other', '{}')).toBeNull();
    expect(toInboxEvent('chat', '{not json')).toBeNull();
  });
});

describe('inbox api', () => {
  it('listChats builds the query string', async () => {
    const fetch = mockFetch({ [`GET ${B}/phone-numbers/p1/chats`]: { status: 200, body: { items: [], hasMore: false } } });
    await listChats('tok', 'w1', 'p1', { scope: 'TEAM', status: 'OPEN', unread: true, limit: 50 });
    const url = String(fetch.mock.calls[0][0]);
    expect(url).toContain('scope=TEAM&status=OPEN&unread=true&limit=50');
    expect(requestTo(fetch, `GET ${B}/phone-numbers/p1/chats`)?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('listChats omits unset filters and encodes the rest', async () => {
    const fetch = mockFetch({ [`GET ${B}/phone-numbers/p1/chats`]: { status: 200, body: { items: [], hasMore: false } } });
    await listChats('tok', 'w1', 'p1', { scope: 'MINE', q: 'ra j', before: '2026-01-01T00:00:00Z' });
    const url = String(fetch.mock.calls[0][0]);
    expect(url).toBe(`${B}/phone-numbers/p1/chats?scope=MINE&q=ra+j&before=2026-01-01T00%3A00%3A00Z`);
  });

  it('listChats without filters has no query string', async () => {
    const fetch = mockFetch({ [`GET ${B}/phone-numbers/p1/chats`]: { status: 200, body: { items: [], hasMore: false } } });
    await listChats('tok', 'w1', 'p1');
    expect(String(fetch.mock.calls[0][0])).toBe(`${B}/phone-numbers/p1/chats`);
  });

  it('sendText posts {text}', async () => {
    const fetch = mockFetch({ [`POST ${B}/chats/c1/messages`]: { status: 200, body: { id: 'm1' } } });
    await sendText('tok', 'w1', 'c1', 'hello');
    expect(requestTo(fetch, `POST ${B}/chats/c1/messages`)?.body).toEqual({ text: 'hello' });
  });

  it('sendTemplate posts {templateId, values}', async () => {
    const fetch = mockFetch({ [`POST ${B}/chats/c1/messages`]: { status: 200, body: { id: 'm1' } } });
    await sendTemplate('tok', 'w1', 'c1', 't1', { agentName: 'Asha' });
    expect(requestTo(fetch, `POST ${B}/chats/c1/messages`)?.body).toEqual({
      templateId: 't1',
      values: { agentName: 'Asha' },
    });
  });

  it('reads numbers, a chat, a thread page and assignees', async () => {
    const fetch = mockFetch({
      [`GET ${B}/phone-numbers`]: { status: 200, body: [] },
      [`GET ${B}/chats/c1`]: { status: 200, body: { id: 'c1' } },
      [`GET ${B}/chats/c1/thread`]: { status: 200, body: { items: [], hasMore: false } },
      [`GET ${B}/assignees`]: { status: 200, body: { users: [], teams: [] } },
    });
    expect(await listInboxNumbers('tok', 'w1')).toEqual([]);
    expect(await getChat('tok', 'w1', 'c1')).toEqual({ id: 'c1' });
    await getThread('tok', 'w1', 'c1', '2026-01-01T00:00:00Z');
    expect(await getAssignees('tok', 'w1')).toEqual({ users: [], teams: [] });
    const threadUrl = String(fetch.mock.calls.find(([u]) => String(u).includes('/thread'))?.[0]);
    expect(threadUrl).toBe(`${B}/chats/c1/thread?before=2026-01-01T00%3A00%3A00Z`);
  });

  it('posts the chat actions', async () => {
    const fetch = mockFetch({
      [`POST ${B}/chats/c1/read`]: { status: 204 },
      [`POST ${B}/chats/c1/assign`]: { status: 200, body: { id: 'c1' } },
      [`POST ${B}/chats/c1/unassign`]: { status: 200, body: { id: 'c1' } },
      [`POST ${B}/chats/c1/close`]: { status: 200, body: { id: 'c1' } },
      [`POST ${B}/chats/c1/reopen`]: { status: 200, body: { id: 'c1' } },
    });
    await markRead('tok', 'w1', 'c1');
    await assignChat('tok', 'w1', 'c1', { userId: 'u1' });
    await unassignChat('tok', 'w1', 'c1');
    await closeChat('tok', 'w1', 'c1');
    await reopenChat('tok', 'w1', 'c1');
    expect(requestTo(fetch, `POST ${B}/chats/c1/assign`)?.body).toEqual({ userId: 'u1' });
  });

  it('gets and puts the settings', async () => {
    const settings = {
      routing: { mode: 'TEAM' as const, teamId: 't1', userId: null },
      claimOnReply: true,
      keepAssignmentOnClose: false,
    };
    const fetch = mockFetch({
      [`GET ${B}/phone-numbers/p1/settings`]: { status: 200, body: settings },
      [`PUT ${B}/phone-numbers/p1/settings`]: { status: 200, body: settings },
    });
    expect(await getInboxSettings('tok', 'w1', 'p1')).toEqual(settings);
    await putInboxSettings('tok', 'w1', 'p1', settings);
    expect(requestTo(fetch, `PUT ${B}/phone-numbers/p1/settings`)?.body).toEqual(settings);
  });

  it('builds the media and stream paths', () => {
    expect(chatMediaUrl('w1', 'c1', 'm 1')).toBe(`${B}/chats/c1/messages/m%201/media`);
    expect(streamUrl('w1', 'p1')).toBe(`${B}/phone-numbers/p1/stream`);
  });

  it('fetches media as a blob with the bearer token', async () => {
    const path = chatMediaUrl('w1', 'c1', 'm1');
    const fetch = mockFetch({ [`GET ${path}`]: { status: 200, text: 'bytes', headers: { 'Content-Type': 'image/png' } } });
    const blob = await fetchMedia('tok', path);
    expect(blob.size).toBe(5);
    expect(requestTo(fetch, `GET ${path}`)?.headers.get('Authorization')).toBe('Bearer tok');
  });
});
