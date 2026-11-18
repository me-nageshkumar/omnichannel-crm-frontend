import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CurrentUser } from '@app/api/users';
import type { KnowledgeSource } from '@app/api/aiKnowledge';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { gate } from '../../../test/gate';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { AI_BASE, CONNECTION, SCRIPTED_CONNECTION, aiRoutes } from '../../../test/ai';
import { KB, KB_BASE, SOURCES, knowledgeRoutes } from '../../../test/aiKnowledge';

const VIEWER: CurrentUser = {
  ...WORKSPACE_MANAGER,
  workspaces: [{ ...BRAND_A, role: { id: 'r-av', name: 'AI_VIEWER' }, authorities: ['ai:view'] }],
};

const routes = (extra = {}, user: CurrentUser = WORKSPACE_MANAGER) => ({
  ...meAs(user),
  ...aiRoutes({ [`GET ${AI_BASE}/connections`]: { status: 200, body: [CONNECTION, SCRIPTED_CONNECTION] } }),
  ...knowledgeRoutes(),
  ...extra,
});

async function openTab(extra = {}, user: CurrentUser = WORKSPACE_MANAGER) {
  const fetch = mockFetch(routes(extra, user));
  renderApp('/ai?tab=knowledge');
  await screen.findByRole('row', { name: /Bimal courses/ });
  return fetch;
}

async function openBase(extra = {}, user: CurrentUser = WORKSPACE_MANAGER) {
  const fetch = mockFetch(routes(extra, user));
  renderApp('/ai/knowledge/kb1');
  await screen.findByRole('row', { name: /Counsellor pitch/ });
  return fetch;
}

const row = (name: RegExp) => screen.getByRole('row', { name });
const allReady = SOURCES.map((s): KnowledgeSource => ({ ...s, state: 'READY', error: null }));

describe('Knowledge tab', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('listsKnowledgeBasesWithCountsAndUse', async () => {
    await openTab();
    const r = row(/Bimal courses/);
    expect(within(r).getByText('12 sources · 10 ready · 1 failed · 1 adding')).toBeVisible();
    expect(within(r).getByText('Bimal counsellor')).toBeVisible();
    expect(within(r).queryByText(/Used by:/)).toBeNull();
    expect(within(r).getByText('18 Nov')).toBeVisible();
    expect(within(r).getByText('OpenAI · Main key')).toBeVisible();
  });

  it('createsAKnowledgeBaseOnAnOpenAiConnection', async () => {
    const user = userEvent.setup();
    const created = {
      ...KB,
      id: 'kb2',
      name: 'Fees',
      usedBy: [],
      counts: { queued: 0, adding: 0, ready: 0, failed: 0 },
      sourceCount: 0,
    };
    const fetch = await openTab({ [`POST ${KB_BASE}`]: { status: 201, body: created } });

    await user.click(screen.getByRole('button', { name: 'New knowledge base' }));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText('Connection');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Main key']);
    await user.type(within(dialog).getByLabelText(/Name/), 'Fees');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    await screen.findByRole('row', { name: /Fees/ });
    expect(requestTo(fetch, `POST ${KB_BASE}`)?.body).toEqual({ name: 'Fees', description: null, connectionId: 'k1' });
  });

  it('emptyTabInvitesTheFirstKnowledgeBase', async () => {
    mockFetch(routes({ [`GET ${KB_BASE}`]: { status: 200, body: [] } }));
    renderApp('/ai?tab=knowledge');
    expect(await screen.findByRole('heading', { name: 'No knowledge bases yet' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'New knowledge base' }).length).toBeGreaterThan(0);
  });

  it('deleteInUseShowsServerSentence', async () => {
    const user = userEvent.setup();
    await openTab({
      [`DELETE ${KB_BASE}/kb1`]: {
        status: 409,
        body: { error: 'ai_knowledge_in_use', message: 'Used by profiles: Bimal counsellor' },
      },
    });

    await user.click(within(row(/Bimal courses/)).getByRole('button', { name: 'Delete Bimal courses' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByText('Used by profiles: Bimal counsellor')).toBeVisible();
  });
});

describe('A knowledge base page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sourcesShowStates', async () => {
    await openBase();
    expect(within(row(/CFTP Digital Brochure/)).getByText('Ready')).toBeVisible();
    expect(within(row(/CFTP Digital Brochure/)).getByText('14.0 MB')).toBeVisible();
    expect(within(row(/blog/)).getByText('Failed: The page answered 403')).toBeVisible();
    expect(within(row(/Answers the team confirms/)).getByText('Adding')).toBeVisible();
    expect(within(row(/Crypto & Forex/)).getByText('Web page')).toBeVisible();
  });

  it('failedPageOffersRetryOnlyAndNoViewText', async () => {
    await openBase();
    const failed = row(/blog/);
    expect(within(failed).getByRole('button', { name: /^Retry/ })).toBeVisible();
    expect(within(failed).queryByRole('button', { name: /^Fetch again/ })).toBeNull();
    expect(within(failed).queryByRole('button', { name: /^View text/ })).toBeNull();
  });

  it('emptyBaseSaysWhatToAdd', async () => {
    mockFetch(routes({ [`GET ${KB_BASE}/kb1/sources`]: { status: 200, body: [] } }));
    renderApp('/ai/knowledge/kb1');
    expect(await screen.findByRole('heading', { name: 'No sources yet' })).toBeVisible();
    expect(screen.getByText(/brochure, course pages or a note/)).toBeVisible();
  });

  it('viewTextErrorIsWorded', async () => {
    const user = userEvent.setup();
    await openBase({ [`GET ${KB_BASE}/kb1/sources/s3/content`]: { status: 404, body: { error: 'NOT_FOUND' } } });
    await user.click(within(row(/Counsellor pitch/)).getByRole('button', { name: 'View text Counsellor pitch' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).queryByRole('progressbar')).toBeNull());
    expect(within(dialog).queryByText('NOT_FOUND')).toBeNull();
    expect(within(dialog).queryByText('HTTP 404')).toBeNull();
  });

  it('uploadShowsProgressAndBlocksASecondFile', async () => {
    const added: KnowledgeSource = {
      ...SOURCES[0],
      id: 's7',
      title: 'fees.pdf',
      fileName: 'fees.pdf',
      state: 'QUEUED',
    };
    const fetch = await openBase({ [`POST ${KB_BASE}/kb1/sources/file`]: { status: 201, body: added } });
    const held = gate(fetch, `POST ${KB_BASE}/kb1/sources/file`, 1);

    fireEvent.change(screen.getByLabelText('File to add'), {
      target: { files: [new File(['%PDF'], 'fees.pdf', { type: 'application/pdf' })] },
    });

    const button = await screen.findByRole('button', { name: /Uploading/ });
    expect(button).toBeDisabled();
    held.release();
    expect(await screen.findByRole('button', { name: 'Add file' })).toBeEnabled();
  });

  it('stopsRefreshingWhenNothingIsAdding', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let answer: KnowledgeSource[] = SOURCES;
    const fetch = await openBase({ [`GET ${KB_BASE}/kb1/sources`]: () => ({ status: 200, body: answer }) });
    const before = callsTo(fetch, `GET ${KB_BASE}/kb1/sources`);

    answer = allReady;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await waitFor(() => expect(callsTo(fetch, `GET ${KB_BASE}/kb1/sources`)).toBe(before + 1));
    await waitFor(() => expect(within(row(/Answers the team confirms/)).getByText('Ready')).toBeVisible());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(callsTo(fetch, `GET ${KB_BASE}/kb1/sources`)).toBe(before + 1);
  });

  it('addsAWebPageAndANote', async () => {
    const user = userEvent.setup();
    const page: KnowledgeSource = {
      ...SOURCES[1],
      id: 's8',
      title: 'https://bimalinstitute.com/about-us/',
      url: 'https://bimalinstitute.com/about-us/',
      state: 'QUEUED',
    };
    const note: KnowledgeSource = { ...SOURCES[2], id: 's9', title: 'Batch timings', state: 'QUEUED' };
    const fetch = await openBase({
      [`POST ${KB_BASE}/kb1/sources/web-page`]: { status: 201, body: page },
      [`POST ${KB_BASE}/kb1/sources/note`]: { status: 201, body: note },
    });

    await user.click(screen.getByRole('button', { name: 'Add web page' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Address/), 'https://bimalinstitute.com/about-us/');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(await screen.findByRole('row', { name: /about-us/ })).getByText('Adding')).toBeVisible();
    expect(requestTo(fetch, `POST ${KB_BASE}/kb1/sources/web-page`)?.body).toEqual({
      url: 'https://bimalinstitute.com/about-us/',
    });

    await user.click(screen.getByRole('button', { name: 'Add note' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Title/), 'Batch timings');
    await user.type(within(dialog).getByLabelText(/Text/), 'Morning and evening batches');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await screen.findByRole('row', { name: /Batch timings/ });
    expect(requestTo(fetch, `POST ${KB_BASE}/kb1/sources/note`)?.body).toEqual({
      title: 'Batch timings',
      text: 'Morning and evening batches',
    });
  });

  it('bigFileRefusedBeforeUpload', async () => {
    const fetch = await openBase();
    const big = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 17 * 1024 * 1024 });

    fireEvent.change(screen.getByLabelText('File to add'), { target: { files: [big] } });

    expect(await screen.findByText('Files up to 16 MB')).toBeVisible();
    expect(callsTo(fetch, `POST ${KB_BASE}/kb1/sources/file`)).toBe(0);
  });

  it('uploadsAFile', async () => {
    const added: KnowledgeSource = {
      ...SOURCES[0],
      id: 's7',
      title: 'fees.pdf',
      fileName: 'fees.pdf',
      size: 2048,
      state: 'QUEUED',
    };
    const fetch = await openBase({ [`POST ${KB_BASE}/kb1/sources/file`]: { status: 201, body: added } });

    fireEvent.change(screen.getByLabelText('File to add'), {
      target: { files: [new File(['%PDF'], 'fees.pdf', { type: 'application/pdf' })] },
    });

    expect(within(await screen.findByRole('row', { name: /fees\.pdf/ })).getByText('Adding')).toBeVisible();
    expect(callsTo(fetch, `POST ${KB_BASE}/kb1/sources/file`)).toBe(1);
  });

  it('removedSourceShowsRemovingUntilGone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let answer: KnowledgeSource[] = allReady;
    await openBase({
      [`GET ${KB_BASE}/kb1/sources`]: () => ({ status: 200, body: answer }),
      [`DELETE ${KB_BASE}/kb1/sources/s3`]: { status: 202, body: { ...allReady[2], state: 'REMOVING' } },
    });

    await user.click(within(row(/Counsellor pitch/)).getByRole('button', { name: 'Remove Counsellor pitch' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(await within(row(/Counsellor pitch/)).findByText('Removing')).toBeVisible();

    answer = allReady.filter((s) => s.id !== 's3');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await waitFor(() => expect(screen.queryByRole('row', { name: /Counsellor pitch/ })).toBeNull());
  });

  it('fetchAgainAndRetrySendActions', async () => {
    const user = userEvent.setup();
    const fetch = await openBase({
      [`PUT ${KB_BASE}/kb1/sources/s2`]: { status: 200, body: { ...SOURCES[1], state: 'QUEUED' } },
      [`PUT ${KB_BASE}/kb1/sources/s4`]: { status: 200, body: { ...SOURCES[3], state: 'QUEUED', error: null } },
    });

    await user.click(
      within(row(/Crypto & Forex/)).getByRole('button', { name: 'Fetch again Crypto & Forex Trading Program' }),
    );
    await user.click(within(row(/blog/)).getByRole('button', { name: /^Retry/ }));

    await waitFor(() => expect(requestTo(fetch, `PUT ${KB_BASE}/kb1/sources/s4`)?.body).toEqual({ action: 'RETRY' }));
    expect(requestTo(fetch, `PUT ${KB_BASE}/kb1/sources/s2`)?.body).toEqual({ action: 'FETCH_AGAIN' });
  });

  it('viewTextShowsStoredMarkdown', async () => {
    const user = userEvent.setup();
    await openBase({
      [`GET ${KB_BASE}/kb1/sources/s3/content`]: {
        status: 200,
        text: '# Counsellor pitch\n\nGreetings From Bimal Institute',
      },
    });

    await user.click(within(row(/Counsellor pitch/)).getByRole('button', { name: 'View text Counsellor pitch' }));

    expect(await within(await screen.findByRole('dialog')).findByText(/Greetings From Bimal Institute/)).toBeVisible();
  });

  it('viewerSeesNoChangeButtons', async () => {
    await openBase({}, VIEWER);
    expect(screen.queryByRole('button', { name: 'Add file' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add web page' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(within(row(/Counsellor pitch/)).getByRole('button', { name: 'View text Counsellor pitch' })).toBeVisible();
  });
});
