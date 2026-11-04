import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFilter, resolveContactIds, getFilter, isAdvanced, previewFilter, updateFilter } from '@app/api/contacts';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { LAPSED_TREE, advancedFilter, filterPreview } from '../../test/contacts';

const B = '/api/workspaces/w1';

afterEach(() => vi.unstubAllGlobals());

describe('contact filters api', () => {
  it('previewSendsTheTreeAndSample', async () => {
    const reply = filterPreview();
    const fetch = mockFetch({ [`POST ${B}/contact-filters/preview`]: { status: 200, body: reply } });
    await expect(previewFilter('t', 'w1', LAPSED_TREE, 10)).resolves.toEqual(reply);
    expect(requestTo(fetch, `POST ${B}/contact-filters/preview`)?.body).toEqual({ rules: LAPSED_TREE, sample: 10 });
    const bare = mockFetch({ [`POST ${B}/contact-filters/preview`]: { status: 200, body: reply } });
    await previewFilter('t', 'w1', LAPSED_TREE);
    expect(requestTo(bare, `POST ${B}/contact-filters/preview`)?.body).toEqual({ rules: LAPSED_TREE });
  });

  it('getsOneFilter', async () => {
    const f = advancedFilter({ id: 'f2', name: 'Lapsed VIPs' });
    mockFetch({ [`GET ${B}/contact-filters/f2`]: { status: 200, body: f } });
    await expect(getFilter('t', 'w1', 'f2')).resolves.toEqual(f);
  });

  it('createsAnAdvancedFilter', async () => {
    const body = { name: 'Lapsed VIPs', rules: LAPSED_TREE };
    const fetch = mockFetch({
      [`POST ${B}/contact-filters`]: { status: 201, body: advancedFilter({ id: 'f2', name: 'Lapsed VIPs' }) },
    });
    await createFilter('t', 'w1', body);
    expect(requestTo(fetch, `POST ${B}/contact-filters`)?.body).toEqual(body);
  });

  it('updatesAnAdvancedFilter', async () => {
    const body = { name: 'Lapsed VIPs 2', rules: LAPSED_TREE };
    const fetch = mockFetch({
      [`PUT ${B}/contact-filters/f2`]: { status: 200, body: advancedFilter({ id: 'f2', name: 'Lapsed VIPs 2' }) },
    });
    await updateFilter('t', 'w1', 'f2', body);
    expect(requestTo(fetch, `PUT ${B}/contact-filters/f2`)?.body).toEqual(body);
  });

  it('createsASimpleFilterAsBefore', async () => {
    const body = { name: 'Chat people', filter: { source: ['CHAT' as const] } };
    const fetch = mockFetch({
      [`POST ${B}/contact-filters`]: { status: 201, body: advancedFilter({ id: 'f3', name: 'Chat people' }) },
    });
    await createFilter('t', 'w1', body);
    expect(requestTo(fetch, `POST ${B}/contact-filters`)?.body).toEqual(body);
  });

  it('isAdvancedReadsNullAsSimple', () => {
    expect(isAdvanced({ kind: null })).toBe(false);
    expect(isAdvanced({})).toBe(false);
    expect(isAdvanced({ kind: 'SIMPLE' })).toBe(false);
    expect(isAdvanced({ kind: 'ADVANCED' })).toBe(true);
  });

  it('resolvesHiddenIds', async () => {
    const fetch = mockFetch({ [`POST ${B}/contacts/resolve-ids`]: { status: 202, body: { queued: 3 } } });
    await expect(resolveContactIds('t', 'w1')).resolves.toEqual({ queued: 3 });
    expect(callsTo(fetch, `POST ${B}/contacts/resolve-ids`)).toBe(1);
  });
});
