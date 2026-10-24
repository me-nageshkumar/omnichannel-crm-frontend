import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleDeal } from '../../../test/crm';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { storeSession } from '../../../test/session';
import type { Note } from '@app/api/crm';
import { rejectReason } from '@app/Crm/notes/attachmentRules';

const AUTH = ['crm:view', 'crm:edit'];
const NOTES = `GET ${BASE}/notes`;

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1',
  target: { type: 'DEAL', id: 'd1' },
  body: 'First call went well',
  pinned: false,
  attachments: [],
  author: { id: 'u4', name: 'Meera Manager' },
  creationTime: '2026-10-20T10:00:00Z',
  lastUpdateTime: '2026-10-20T10:00:00Z',
  version: 0,
  ...over,
});
const page = (items: Note[]) => ({ status: 200, body: { items, total: items.length, page: 0 } });

const routes = (extra = {}, authorities = AUTH) =>
  boardRoutes(
    {
      [`GET ${BASE}/deals/d1`]: { status: 200, body: sampleDeal() },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
      [NOTES]: page([note()]),
      ...extra,
    },
    { authorities },
  );

async function openNotes(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('tab', { name: 'Notes' }));
  return screen.findByRole('list', { name: 'Notes' });
}

const file = (name: string, type: string, size: number) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('CRM notes', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('composerSavesOnCtrlEnter', async () => {
    const f = mockFetch(
      routes({ [`POST ${BASE}/notes`]: { status: 200, body: note({ id: 'n2', body: 'Sent the **quote**' }) } }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openNotes(user);
    const box = screen.getByLabelText('New note');
    await user.type(box, 'Sent the **quote**');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/notes`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/notes`)?.body).toEqual({
      target: { type: 'DEAL', id: 'd1' },
      body: 'Sent the **quote**',
    });
    expect(await screen.findByText('quote', { selector: 'strong' })).toBeInTheDocument();
    expect(box).toHaveValue('');
  });

  it('loadMoreKeepsTheDraft', async () => {
    const first = Array.from({ length: 20 }, (_, i) =>
      note({ id: `n${i}`, body: `Note ${i}`, creationTime: new Date(Date.UTC(2026, 9, 20, 0, 40 - i)).toISOString() }),
    );
    const rest = Array.from({ length: 5 }, (_, i) =>
      note({ id: `m${i}`, body: `Older ${i}`, creationTime: new Date(Date.UTC(2026, 9, 1, 0, 10 - i)).toISOString() }),
    );
    let gets = 0;
    mockFetch(
      routes({
        [NOTES]: () => ({ status: 200, body: { items: ++gets === 1 ? first : rest, total: 25, page: gets - 1 } }),
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    const list = await openNotes(user);
    await user.type(screen.getByLabelText('New note'), 'Half a thought');
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(within(list).getAllByText(/^(Note|Older) \d+$/)).toHaveLength(25));
    expect(screen.getByLabelText('New note')).toHaveValue('Half a thought');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('pinnedNotesFirst', async () => {
    mockFetch(
      routes({
        [NOTES]: page([
          note({ id: 'n1', body: 'Newer', creationTime: '2026-10-22T10:00:00Z' }),
          note({ id: 'n2', body: 'Pinned old', pinned: true, creationTime: '2026-10-01T10:00:00Z' }),
        ]),
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    const list = await openNotes(user);
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Pinned old');
    expect(items[1]).toHaveTextContent('Newer');
  });

  it('markdownDoesNotRenderHtmlOrJsLinks', async () => {
    mockFetch(
      routes({
        [NOTES]: page([
          note({
            body: '<script>x</script>\n\nSee [a](javascript:alert(1)) and [b](https://example.com) <img src=x onerror=alert(1)>',
          }),
        ]),
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    const list = await openNotes(user);
    expect(list.querySelector('script')).toBeNull();
    expect(list.querySelector('img')).toBeNull();
    const a = within(list).getByText('a');
    expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    const b = within(list).getByRole('link', { name: 'b' });
    expect(b).toHaveAttribute('rel', 'noopener noreferrer');
    expect(b).toHaveAttribute('target', '_blank');
  });

  it('oversizeFileRejectedBeforeUpload', async () => {
    const f = mockFetch(routes());
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openNotes(user);
    await user.upload(
      screen.getByLabelText('Attach file to note'),
      file('big.pdf', 'application/pdf', 11 * 1024 * 1024),
    );
    expect(await screen.findByText('Files may be at most 10 MB.')).toBeInTheDocument();
    expect(callsTo(f, `POST ${BASE}/notes/n1/attachments`)).toBe(0);
  });

  it('sixthFileRejected', () => {
    expect(rejectReason(file('a.pdf', 'application/pdf', 10), 5)).toBe('A note holds at most 5 files.');
    expect(rejectReason(file('a.pdf', 'application/pdf', 10), 4)).toBeNull();
    expect(rejectReason(file('logo.svg', 'image/svg+xml', 10), 0)).toBe(
      'Only images, PDF, Office documents, CSV and plain text can be attached.',
    );
    expect(rejectReason(file('evil.exe', 'image/png', 10), 0)).not.toBeNull();
    expect(rejectReason(file('Report.PDF', '', 10), 0)).toBeNull();
  });

  it('uploadSendsTheFile', async () => {
    const f = mockFetch(
      routes({
        [`POST ${BASE}/notes/n1/attachments`]: {
          status: 200,
          body: note({
            attachments: [{ id: 'a1', fileName: 'quote.pdf', contentType: 'application/pdf', size: 2048 }],
          }),
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openNotes(user);
    await user.upload(screen.getByLabelText('Attach file to note'), file('quote.pdf', 'application/pdf', 2048));
    expect(await screen.findByRole('button', { name: 'Download quote.pdf (2 KB)' })).toBeInTheDocument();
    expect(callsTo(f, `POST ${BASE}/notes/n1/attachments`)).toBe(1);
  });

  it('downloadSavesFile', async () => {
    const created = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('quote.pdf');
    });
    mockFetch(
      routes({
        [NOTES]: page([
          note({ attachments: [{ id: 'a1', fileName: 'quote.pdf', contentType: 'application/pdf', size: 2048 }] }),
        ]),
        [`GET ${BASE}/notes/n1/attachments/a1`]: {
          status: 200,
          text: '%PDF',
          headers: { 'Content-Type': 'application/pdf' },
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openNotes(user);
    await user.click(screen.getByRole('button', { name: 'Download quote.pdf (2 KB)' }));
    await waitFor(() => expect(clicked).toHaveBeenCalled());
    expect(created).toHaveBeenCalled();
  });

  it('deleteAsksConfirmation', async () => {
    const f = mockFetch(routes({ [`DELETE ${BASE}/notes/n1`]: { status: 204 } }));
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openNotes(user);
    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    const dialog = await screen.findByRole('dialog', { name: /Delete this note\?/ });
    expect(callsTo(f, `DELETE ${BASE}/notes/n1`)).toBe(0);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(callsTo(f, `DELETE ${BASE}/notes/n1`)).toBe(1));
    await waitFor(() => expect(screen.queryByText('First call went well')).toBeNull());
  });

  it('othersCannotEditWithoutDelete', async () => {
    mockFetch(routes({ [NOTES]: page([note({ author: { id: 'u9', name: 'Someone' } })]) }));
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openNotes(user);
    expect(screen.queryByRole('button', { name: 'Edit note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pin note' })).toBeInTheDocument();
  });
});
