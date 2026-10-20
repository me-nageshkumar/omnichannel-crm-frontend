import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archiveTemplate,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getCategories,
  getTemplate,
  listTemplates,
  renderTemplate,
  templateMediaUrl,
  unarchiveTemplate,
  updateTemplate,
  uploadTemplateMedia,
} from '@app/api/templates';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { template } from '../../test/templates';

const B = '/api/workspaces/w1';
const T = template({ id: 't1' });

afterEach(() => vi.unstubAllGlobals());

describe('templates api', () => {
  it('listsWithOnlyTheFiltersGiven', async () => {
    const fetch = mockFetch({ [`GET ${B}/templates`]: { status: 200, body: [T] } });
    expect(
      await listTemplates('tok', 'w1', { q: 'wel come', type: 'IMAGE', category: '', status: 'ARCHIVED' }),
    ).toEqual([T]);
    const url = String(fetch.mock.calls[0][0]);
    expect(url).toBe(`${B}/templates?q=wel+come&type=IMAGE&status=ARCHIVED`);
    expect(requestTo(fetch, `GET ${B}/templates`)?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('listsWithoutFilters', async () => {
    const fetch = mockFetch({ [`GET ${B}/templates`]: { status: 200, body: [] } });
    await listTemplates('tok', 'w1', {});
    expect(String(fetch.mock.calls[0][0])).toBe(`${B}/templates`);
  });

  it('getsOneAndCategories', async () => {
    mockFetch({
      [`GET ${B}/templates/t1`]: { status: 200, body: T },
      [`GET ${B}/templates/categories`]: { status: 200, body: ['Promo'] },
    });
    expect(await getTemplate('tok', 'w1', 't1')).toEqual(T);
    expect(await getCategories('tok', 'w1')).toEqual(['Promo']);
  });

  it('createsAndUpdates', async () => {
    const fetch = mockFetch({
      [`POST ${B}/templates`]: { status: 201, body: T },
      [`PUT ${B}/templates/t1`]: { status: 200, body: T },
    });
    const req = {
      name: 'n',
      category: null,
      type: 'TEXT' as const,
      content: T.content,
      mediaId: null,
      placeholders: [],
      version: 0,
    };
    await createTemplate('tok', 'w1', req);
    await updateTemplate('tok', 'w1', 't1', req);
    expect(requestTo(fetch, `POST ${B}/templates`)?.body).toEqual(req);
    expect(requestTo(fetch, `PUT ${B}/templates/t1`)?.body).toEqual(req);
  });

  it('archivesUnarchivesDeletes', async () => {
    const fetch = mockFetch({
      [`POST ${B}/templates/t1/archive`]: { status: 200, body: T },
      [`POST ${B}/templates/t1/unarchive`]: { status: 200, body: T },
      [`DELETE ${B}/templates/t1`]: { status: 204 },
    });
    await archiveTemplate('tok', 'w1', 't1');
    await unarchiveTemplate('tok', 'w1', 't1');
    await deleteTemplate('tok', 'w1', 't1');
    expect(callsTo(fetch, `POST ${B}/templates/t1/archive`)).toBe(1);
    expect(callsTo(fetch, `POST ${B}/templates/t1/unarchive`)).toBe(1);
    expect(callsTo(fetch, `DELETE ${B}/templates/t1`)).toBe(1);
  });

  it('duplicatesAndRenders', async () => {
    const fetch = mockFetch({
      [`POST ${B}/templates/t1/duplicate`]: { status: 201, body: T },
      [`POST ${B}/templates/t1/render`]: {
        status: 200,
        body: { type: 'TEXT', content: T.content, media: null, vcard: null, missing: [], warnings: [] },
      },
    });
    await duplicateTemplate('tok', 'w1', 't1', { targetWorkspaceId: 'w2', name: 'n (copy)' });
    await renderTemplate('tok', 'w1', 't1', { contactId: 'c1', values: { a: 'b' } });
    expect(requestTo(fetch, `POST ${B}/templates/t1/duplicate`)?.body).toEqual({
      targetWorkspaceId: 'w2',
      name: 'n (copy)',
    });
    expect(requestTo(fetch, `POST ${B}/templates/t1/render`)?.body).toEqual({ contactId: 'c1', values: { a: 'b' } });
  });

  it('uploadsMediaAsMultipart', async () => {
    const view = { mediaId: 'm1', fileName: 'a.png', mimeType: 'image/png', size: 3 };
    const fetch = mockFetch({ [`POST ${B}/template-media`]: { status: 201, body: view } });
    const file = new File(['abc'], 'a.png', { type: 'image/png' });
    expect(await uploadTemplateMedia('tok', 'w1', file)).toEqual(view);
    const body = fetch.mock.calls[0][1]?.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
  });

  it('buildsTheMediaUrl', () => {
    expect(templateMediaUrl('w 1', 'm1')).toBe('/api/workspaces/w%201/template-media/m1');
  });
});
