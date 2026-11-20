import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { render } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_VIEWER, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { rowWith } from '../../test/admin';
import { cloudTemplate } from '../../test/cloudTemplates';
import { CloudTemplatePreview } from '@app/CloudTemplates/CloudTemplatePreview';

const BASE = '/api/workspaces/w1/meta/templates';

const FOLLOW_UP = cloudTemplate({ id: 't1', name: 'course_follow_up' });
const REJECTED = cloudTemplate({
  id: 't2',
  name: 'fees_offer',
  status: 'REJECTED',
  rejectedReason: 'INCORRECT_CATEGORY',
  sendable: false,
});
const CAROUSEL = cloudTemplate({
  id: 't3',
  name: 'courses',
  supported: false,
  unsupportedReason: 'Not supported yet: CAROUSEL',
  sendable: false,
});
const PAUSED = cloudTemplate({ id: 't4', name: 'reminder', status: 'PAUSED', sendable: false });

function routes(extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}`]: { status: 200, body: [FOLLOW_UP, REJECTED, CAROUSEL, PAUSED] },
    'GET /api/workspaces/w1/contact-attributes': { status: 200, body: [] },
    ...extra,
  };
}

describe('WhatsApp templates page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsWithStatusAndSendable', async () => {
    mockFetch(routes());
    renderApp('/whatsapp-templates');
    expect(await screen.findByRole('heading', { name: 'WhatsApp templates' })).toBeVisible();
    expect(within(await rowWith('course_follow_up')).getByText('Approved')).toBeVisible();
    const rejected = await rowWith('fees_offer');
    expect(within(rejected).getByText('Rejected')).toBeVisible();
    expect(within(rejected).getByText('INCORRECT_CATEGORY')).toBeVisible();
    expect(within(await rowWith('reminder')).getByText('Paused')).toBeVisible();
    const carousel = await rowWith('courses');
    expect(within(carousel).getByText('Not supported yet: CAROUSEL')).toBeVisible();
    expect(within(carousel).queryByRole('button', { name: 'Fills' })).toBeNull();
  });

  it('syncShowsCounts', async () => {
    mockFetch(routes({ [`POST ${BASE}/sync`]: { status: 200, body: { added: 2, updated: 1, removed: 0 } } }));
    const { user } = renderApp('/whatsapp-templates');
    await user.click(await screen.findByRole('button', { name: 'Sync from Meta' }));
    expect(await screen.findByText('Synced: 2 added, 1 updated, 0 removed')).toBeVisible();
  });

  it('fillsSaveKindAndKey', async () => {
    const fetch = mockFetch(
      routes({
        [`PUT ${BASE}/t1/fills`]: {
          status: 200,
          body: { ...FOLLOW_UP, fills: { 'body:1': { kind: 'CONTACT_FIELD', attributeKey: 'name' } } },
        },
      }),
    );
    const { user } = renderApp('/whatsapp-templates');
    await user.click(within(await rowWith('course_follow_up')).getByRole('button', { name: 'Fills' }));
    await user.selectOptions(await screen.findByLabelText('Fill body:1 from'), 'Contact name');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, `PUT ${BASE}/t1/fills`)).toBeDefined());
    expect(requestTo(fetch, `PUT ${BASE}/t1/fills`)?.body).toEqual({
      fills: { 'body:1': { kind: 'CONTACT_FIELD', attributeKey: 'name', fallback: null } },
    });
    expect(await screen.findByText('body:1 ✓, body:2')).toBeVisible();
  });

  it('viewerSeesNoActions', async () => {
    mockFetch({ ...routes(), ...meAs(BRAND_VIEWER) });
    renderApp('/whatsapp-templates');
    expect(await rowWith('course_follow_up')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Sync from Meta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fills' })).toBeNull();
  });
});

describe('CloudTemplatePreview', () => {
  it('previewRendersValues', () => {
    render(<CloudTemplatePreview template={FOLLOW_UP} values={{ 'body:1': 'Veenu' }} />);
    expect(screen.getByText('Veenu')).toBeVisible();
    expect(screen.getByText('{{2}}')).toBeVisible();
    expect(screen.getByText('Bimal Institute')).toBeVisible();
  });
});
