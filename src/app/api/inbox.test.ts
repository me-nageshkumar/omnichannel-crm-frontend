import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionView, MessageView } from '@app/api/inbox';
import {
  assignChat,
  chatMediaUrl,
  claimChat,
  closeChat,
  deleteTeamRouting,
  fetchMedia,
  getAssignees,
  getChat,
  getRoutingDefault,
  getThread,
  handoffChat,
  listChats,
  listInboxNumbers,
  listTeamRouting,
  lookupNumber,
  markRead,
  parseSse,
  putRoutingDefault,
  putTeamRouting,
  reopenChat,
  sendTemplate,
  sendText,
  startChat,
  streamUrl,
  toInboxEvent,
  unassignChat,
} from '@app/api/inbox';
import { urlsOf } from '../../test/admin';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';

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
  it('listChats joins the selected numbers and the filters into one query', async () => {
    const fetch = mockFetch({ [`GET ${B}/chats`]: { status: 200, body: { items: [], hasMore: false } } });
    await listChats('tok', 'w1', { phoneNumberIds: ['a', 'b'], scope: 'TEAM', status: 'OPEN', unread: true, limit: 50 });
    const url = String(fetch.mock.calls[0][0]);
    expect(url).toBe(`${B}/chats?phoneNumberIds=a%2Cb&scope=TEAM&status=OPEN&unread=true&limit=50`);
    expect(requestTo(fetch, `GET ${B}/chats`)?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('listChats omits an empty number filter and unset filters, and encodes the rest', async () => {
    const fetch = mockFetch({ [`GET ${B}/chats`]: { status: 200, body: { items: [], hasMore: false } } });
    await listChats('tok', 'w1', { phoneNumberIds: [], scope: 'MINE', q: 'ra j', before: '2026-01-01T00:00:00Z' });
    expect(String(fetch.mock.calls[0][0])).toBe(`${B}/chats?scope=MINE&q=ra+j&before=2026-01-01T00%3A00%3A00Z`);
    await listChats('tok', 'w1');
    expect(String(fetch.mock.calls[1][0])).toBe(`${B}/chats`);
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

  it("startChat posts a text or a template to the number's chats", async () => {
    const fetch = mockFetch({ [`POST ${B}/phone-numbers/p%201/chats`]: { status: 200, body: { id: 'm1' } } });
    await startChat('tok', 'w1', 'p 1', { phone: '+919876543210', text: 'hello' });
    await startChat('tok', 'w1', 'p 1', { phone: '+919876543210', templateId: 't1', values: { a: 'b' } });
    const key = `POST ${B}/phone-numbers/p%201/chats`;
    expect(callsTo(fetch, key)).toBe(2);
    expect(requestTo(fetch, key, 0)?.body).toEqual({ phone: '+919876543210', text: 'hello' });
    expect(requestTo(fetch, key, 1)?.body).toEqual({
      phone: '+919876543210',
      templateId: 't1',
      values: { a: 'b' },
    });
  });

  it('looks a number up', async () => {
    const key = `GET ${B}/phone-numbers/p1/number-lookup`;
    const fetch = mockFetch({
      [key]: {
        status: 200,
        body: { phone: '919811111111', registered: true, remoteId: 'x@lid', checkedAt: 't', cached: false },
      },
    });
    await expect(lookupNumber('tok', 'w1', 'p1', '919811111111')).resolves.toMatchObject({ registered: true });
    expect(urlsOf(fetch, key)[0]).toContain('?phone=919811111111');
    expect(urlsOf(fetch, key)[0]).not.toContain('force');
  });

  it('forces a fresh lookup', async () => {
    const key = `GET ${B}/phone-numbers/p1/number-lookup`;
    const fetch = mockFetch({
      [key]: {
        status: 200,
        body: { phone: '+919811111111', registered: false, remoteId: null, checkedAt: 't', cached: false },
      },
    });
    await lookupNumber('tok', 'w1', 'p1', '+919811111111', true);
    expect(urlsOf(fetch, key)[0]).toContain('phone=%2B919811111111');
    expect(urlsOf(fetch, key)[0]).toContain('force=true');
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
    expect(await getAssignees('tok', 'w1', 'p1')).toEqual({ users: [], teams: [] });
    expect(urlsOf(fetch, `GET ${B}/assignees`)[0]).toBe(`${B}/assignees?phoneNumberId=p1`);
    const threadUrl = String(fetch.mock.calls.find(([u]) => String(u).includes('/thread'))?.[0]);
    expect(threadUrl).toBe(`${B}/chats/c1/thread?before=2026-01-01T00%3A00%3A00Z`);
  });

  it('reads a mixed thread page with the nested item shape', async () => {
    const message = { id: 'm1', chatId: 'c1', body: 'hi' } as MessageView;
    const action = {
      id: 'a1',
      type: 'ASSIGNED',
      by: null,
      toUser: null,
      toTeam: null,
      at: '2026-01-01T10:01:00Z',
    } as ActionView;
    const items = [
      { kind: 'message', message, action: null, at: '2026-01-01T10:00:00Z' },
      { kind: 'action', message: null, action, at: '2026-01-01T10:01:00Z' },
    ];
    mockFetch({ [`GET ${B}/chats/c1/thread`]: { status: 200, body: { items, hasMore: true } } });
    const page = await getThread('tok', 'w1', 'c1');
    expect(page.hasMore).toBe(true);
    expect(page.items.map((i) => i.kind)).toEqual(['message', 'action']);
    expect(page.items[0].message?.body).toBe('hi');
    expect(page.items[0].action).toBeNull();
    expect(page.items[1].action?.type).toBe('ASSIGNED');
    expect(page.items[1].message).toBeNull();
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

  it('claims a chat and hands it off with the kind in the body', async () => {
    const fetch = mockFetch({
      [`POST ${B}/chats/c1/claim`]: { status: 200, body: { id: 'c1' } },
      [`POST ${B}/chats/c1/handoff`]: { status: 200, body: { id: 'c1' } },
    });
    await claimChat('tok', 'w1', 'c1');
    await handoffChat('tok', 'w1', 'c1', { kind: 'TO_USER', userId: 'u2' });
    await handoffChat('tok', 'w1', 'c1', { kind: 'TO_TEAM' });
    await handoffChat('tok', 'w1', 'c1', { kind: 'TO_TEAM', teamId: 't2' });
    expect(callsTo(fetch, `POST ${B}/chats/c1/claim`)).toBe(1);
    expect(requestTo(fetch, `POST ${B}/chats/c1/handoff`, 0)?.body).toEqual({ kind: 'TO_USER', userId: 'u2' });
    expect(requestTo(fetch, `POST ${B}/chats/c1/handoff`, 1)?.body).toEqual({ kind: 'TO_TEAM' });
    expect(requestTo(fetch, `POST ${B}/chats/c1/handoff`, 2)?.body).toEqual({ kind: 'TO_TEAM', teamId: 't2' });
  });

  it('reads and writes the brand default and team routing settings', async () => {
    const setting = {
      teamId: null,
      inherited: false,
      assignToTeam: true,
      roundRobin: false,
      userId: null,
      stickyDays: 30,
      claimOnReply: true,
      keepAssignmentOnClose: false,
    };
    const fetch = mockFetch({
      [`GET ${B}/settings`]: { status: 200, body: setting },
      [`PUT ${B}/settings`]: { status: 200, body: setting },
      [`GET ${B}/settings/teams`]: { status: 200, body: [{ ...setting, teamId: 't1', inherited: true }] },
      [`PUT ${B}/settings/teams/t1`]: { status: 200, body: { ...setting, teamId: 't1' } },
      [`DELETE ${B}/settings/teams/t1`]: { status: 204 },
    });
    expect(await getRoutingDefault('tok', 'w1')).toEqual(setting);
    await putRoutingDefault('tok', 'w1', { ...setting, roundRobin: true });
    expect(requestTo(fetch, `PUT ${B}/settings`)?.body).toMatchObject({ assignToTeam: true, roundRobin: true });
    expect(await listTeamRouting('tok', 'w1')).toHaveLength(1);
    expect((await putTeamRouting('tok', 'w1', 't1', { ...setting, userId: 'u1' })).teamId).toBe('t1');
    expect(requestTo(fetch, `PUT ${B}/settings/teams/t1`)?.body).toMatchObject({ userId: 'u1' });
    await deleteTeamRouting('tok', 'w1', 't1');
    expect(callsTo(fetch, `DELETE ${B}/settings/teams/t1`)).toBe(1);
  });

  it('builds the media and stream paths', () => {
    expect(chatMediaUrl('w1', 'c1', 'm 1')).toBe(`${B}/chats/c1/messages/m%201/media`);
    expect(streamUrl('w1', ['p1', 'p 2'])).toBe(`${B}/stream?phoneNumberIds=p1%2Cp+2`);
    expect(streamUrl('w1', [])).toBe(`${B}/stream`);
  });

  it('fetches media as a blob with the bearer token', async () => {
    const path = chatMediaUrl('w1', 'c1', 'm1');
    const fetch = mockFetch({
      [`GET ${path}`]: { status: 200, text: 'bytes', headers: { 'Content-Type': 'image/png' } },
    });
    const blob = await fetchMedia('tok', path);
    expect(blob.size).toBe(5);
    expect(requestTo(fetch, `GET ${path}`)?.headers.get('Authorization')).toBe('Bearer tok');
  });
});
