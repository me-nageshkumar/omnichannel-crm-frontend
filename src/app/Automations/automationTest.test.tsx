import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { AutomationTest, Preflight, Rule, StepView, TestContact } from '@app/api/automations';
import type { MockResponse, MockRoute } from '../../test/fetchMock';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { LocationProbe, renderApp } from '../../test/renderApp';
import {
  AUTOMATIONS_BASE,
  CAPTURED_TEST,
  OPTIONS,
  PUBLISHED_RULE,
  WAITING_TEST,
  WELCOME_RULE,
  automationRoutes,
} from '../../test/automations';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const RULE = `${AUTOMATIONS_BASE}/rules/r1`;
const TESTS = `${RULE}/tests`;
const ACTIVE = `${TESTS}/active`;
const PREFLIGHT = `${TESTS}/preflight`;
const X1 = `${AUTOMATIONS_BASE}/tests/x1`;
const CONTACTS = `${AUTOMATIONS_BASE}/test-contacts`;
const PATH = '/automations/r1/test';

const READY: Preflight = { canRun: true, checks: [] };
const ASHA: TestContact = {
  contactId: 'c1',
  name: 'Asha',
  phone: '919811100001',
  numbers: [{ id: 'n1', number: '919928088743', label: 'Main line' }],
};
const HIDDEN: TestContact = { ...ASHA, contactId: 'c2', name: 'Ravi', phone: null };
const NUMBERS = OPTIONS.numbers.map(({ id, number, label }) => ({ id, number, label }));
/** The signed-in manager (WORKSPACE_MANAGER), so the page resumes the test as theirs. */
const ME = { id: 'u4', name: 'Meera Manager' };
const WAITING: AutomationTest = {
  ...WAITING_TEST,
  startedBy: ME,
  target: { contactId: 'c1', name: 'Asha', phone: '919811100001' },
  numbers: NUMBERS,
};
const CAPTURED: AutomationTest = { ...CAPTURED_TEST, startedBy: ME, matched: true };
const step = (index: number, summary: string, extra: Partial<StepView> = {}): StepView => ({
  ...CAPTURED_TEST.actions[index],
  summary,
  ...extra,
});
const ALL_DONE: AutomationTest = {
  ...CAPTURED,
  actions: CAPTURED.actions.map((a) => ({
    ...a,
    outcome: 'DONE',
    reason: 'Done in the test',
    at: '2026-11-03T10:06:00Z',
  })),
  nextAction: null,
};
const ENDED_IDLE: AutomationTest = { ...WAITING, status: 'ENDED', endReason: 'IDLE' };
const WAIT_MESSAGE = "Send a message from Asha's phone to Main line or Sales line.";
const VIEW_ONLY = { ...WORKSPACE_MANAGER, workspaces: [{ ...BRAND_A, authorities: ['automation:view'] }] };

/** Answers each call with the next response; the last one repeats. */
function inTurn(...responses: MockResponse[]): MockRoute {
  let n = 0;
  return () => responses[Math.min(n++, responses.length - 1)];
}

const ok = (body: unknown): MockResponse => ({ status: 200, body });

function open(routes: Record<string, MockRoute> = {}, { fake = false, me = WORKSPACE_MANAGER } = {}) {
  const f = mockFetch({
    ...meAs(me),
    ...automationRoutes({
      [`GET ${RULE}`]: ok(WELCOME_RULE),
      [`GET ${ACTIVE}`]: { status: 204 },
      [`GET ${PREFLIGHT}`]: ok(READY),
      ...routes,
    }),
  });
  const r = renderApp(PATH, <LocationProbe />, fake ? { advanceTimers: vi.advanceTimersByTime } : undefined);
  return { f, ...r };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const startButton = () => screen.findByRole('button', { name: 'Start test' });
const actionRow = (n: number) => within(screen.getByRole('listitem', { name: `Action ${n}` }));

describe('automation test page', () => {
  beforeEach(() => storeSession());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('startsWithATypedNumber', async () => {
    const { f, user } = open({ [`POST ${TESTS}`]: { status: 201, body: WAITING } });
    expect(await screen.findByRole('heading', { name: 'Test “Welcome new chats”' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Choose the test contact' })).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'A number that has never messaged you' }));
    expect(
      screen.getByText(
        'A number WhatsApp hides cannot be typed; choose the contact and switch on “Treat this chat as new”.',
      ),
    ).toBeVisible();
    const phone = screen.getByRole('textbox', { name: 'Phone number, country code first' });
    await user.type(phone, '12');
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(await startButton()).toBeDisabled();
    await user.clear(phone);
    await user.type(phone, '+91 98111 00009');
    expect(phone).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByRole('switch', { name: 'Treat this chat as new' })).not.toBeChecked();
    await user.click(await startButton());
    await waitFor(() => expect(callsTo(f, `POST ${TESTS}`)).toBe(1));
    expect(requestTo(f, `POST ${TESTS}`)?.body).toEqual({ contactId: null, phone: '919811100009', treatAsNew: false });
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
  });

  it('searchesExistingContacts', async () => {
    const { f, user } = open({
      [`GET ${CONTACTS}`]: ok([ASHA, HIDDEN]),
      [`POST ${TESTS}`]: { status: 201, body: WAITING },
    });
    expect(await screen.findByRole('radio', { name: 'An existing contact' })).toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Phone number, country code first' })).toBeNull();
    expect(await startButton()).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Search contacts' }), 'ash');
    const asha = await screen.findByRole('radio', { name: 'Asha · +919811100001 · on Main line' });
    expect(screen.getByRole('radio', { name: 'Ravi · Number hidden · on Main line' })).toBeVisible();
    // the search waits for the typing to stop
    expect(callsTo(f, `GET ${CONTACTS}`)).toBe(1);
    const urls = f.mock.calls.map(([input]) => String(input)).filter((u) => u.indexOf('/test-contacts') >= 0);
    expect(urls).toEqual([`${CONTACTS}?q=ash`]);
    await user.click(asha);
    await user.click(screen.getByRole('switch', { name: 'Treat this chat as new' }));
    await user.click(await startButton());
    await waitFor(() => expect(callsTo(f, `POST ${TESTS}`)).toBe(1));
    expect(requestTo(f, `POST ${TESTS}`)?.body).toEqual({ contactId: 'c1', phone: null, treatAsNew: true });
  });

  it('waitingShowsWhatToDoAndPolls', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { f } = open(
      { [`GET ${ACTIVE}`]: ok(WAITING), [`GET ${X1}`]: inTurn(ok(WAITING), ok(CAPTURED)) },
      { fake: true },
    );
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    expect(
      screen.getByText(
        "Only this contact's messages are taken; everyone else is ignored. Published rules keep running for this contact.",
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Stop test' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start test' })).toBeNull();
    expect(callsTo(f, `GET ${X1}`)).toBe(0);
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(2);
    expect(await screen.findByRole('heading', { name: 'The event' })).toBeVisible();
    expect(screen.getByText('Hello')).toBeVisible();
    expect(screen.getByText('New (treated as new)')).toBeVisible();
    expect(screen.queryByText(WAIT_MESSAGE)).toBeNull();
    await advance(2000);
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(2);
  });

  it('aPollRefusedByTheServerStopsPolling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { f } = open(
      { [`GET ${ACTIVE}`]: ok(WAITING), [`GET ${X1}`]: inTurn(ok(WAITING), { status: 404, body: {} }) },
      { fake: true },
    );
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(2);
    expect(
      await screen.findByText('This test is no longer open. Reload the page to see where it stands.'),
    ).toBeVisible();
    await advance(2000);
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(2);
  });

  it('aFailedPollIsRetried', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { f } = open(
      { [`GET ${ACTIVE}`]: ok(WAITING), [`GET ${X1}`]: inTurn({ status: 503, body: {} }, ok(CAPTURED)) },
      { fake: true },
    );
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(2);
    expect(await screen.findByRole('heading', { name: 'The event' })).toBeVisible();
  });

  it('leavingThePageStopsPolling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { f, unmount } = open({ [`GET ${ACTIVE}`]: ok(WAITING), [`GET ${X1}`]: ok(WAITING) }, { fake: true });
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    unmount();
    await advance(6000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
  });

  it('stopTestEndsIt', async () => {
    const { f, user } = open({
      [`GET ${ACTIVE}`]: ok(WAITING),
      [`POST ${X1}/end`]: ok({ ...WAITING, status: 'ENDED', endReason: 'DONE' }),
    });
    await user.click(await screen.findByRole('button', { name: 'Stop test' }));
    await waitFor(() => expect(callsTo(f, `POST ${X1}/end`)).toBe(1));
    expect(await screen.findByText('The test is done.')).toBeVisible();
  });

  it('checksConditionsOneByOne', async () => {
    const before: AutomationTest = { ...CAPTURED, conditions: [], matched: null, nextAction: null };
    const { f, user } = open({ [`GET ${ACTIVE}`]: ok(before), [`POST ${X1}/check`]: ok(CAPTURED) });
    expect(await screen.findByRole('heading', { name: 'Conditions' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Check next condition' }));
    await waitFor(() => expect(callsTo(f, `POST ${X1}/check`)).toBe(1));
    expect(await screen.findByText('✔ Chat is new · saw yes')).toBeVisible();
    expect(screen.getByText('The rule matches.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Check next condition' })).toBeNull();
  });

  it('noConditionsMatchesEveryEvent', async () => {
    open({ [`GET ${ACTIVE}`]: ok({ ...CAPTURED, conditionCount: 0, conditions: [] }) });
    expect(await screen.findByText('No conditions: the rule matches every event.')).toBeVisible();
    expect(screen.queryByText('The rule matches.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check next condition' })).toBeNull();
  });

  it('runsAndSkipsActionsInOrder', async () => {
    const afterRun: AutomationTest = {
      ...CAPTURED,
      actions: [
        step(0, 'Send Welcome', { outcome: 'DONE', reason: 'Sent “Welcome”', at: '2026-11-03T10:06:00Z' }),
        CAPTURED.actions[1],
        CAPTURED.actions[2],
      ],
      nextAction: 1,
    };
    const afterSkip: AutomationTest = {
      ...afterRun,
      actions: [
        afterRun.actions[0],
        step(1, 'Assign to Support', { outcome: 'SKIPPED', reason: 'Skipped in the test' }),
        CAPTURED.actions[2],
      ],
      nextAction: 2,
    };
    const { f, user } = open({
      [`GET ${ACTIVE}`]: ok(CAPTURED),
      [`POST ${X1}/actions/0/run`]: ok(afterRun),
      [`POST ${X1}/actions/1/skip`]: ok(afterSkip),
    });
    expect(await screen.findByRole('heading', { name: 'Actions' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Run' })).toHaveLength(1);
    expect(actionRow(1).getByText('Send Welcome')).toBeVisible();
    expect(actionRow(1).getByText('This really happens to the test contact.')).toBeVisible();
    expect(actionRow(2).queryByRole('button', { name: 'Run' })).toBeNull();
    expect(actionRow(3).queryByRole('button', { name: 'Skip' })).toBeNull();
    await user.click(actionRow(1).getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(callsTo(f, `POST ${X1}/actions/0/run`)).toBe(1));
    expect(await screen.findByText('Done · Sent “Welcome”')).toBeVisible();
    expect(actionRow(1).queryByRole('button', { name: 'Run' })).toBeNull();
    await user.click(actionRow(2).getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(callsTo(f, `POST ${X1}/actions/1/skip`)).toBe(1));
    expect(await screen.findByText('Skipped · Skipped in the test')).toBeVisible();
    expect(actionRow(3).getByRole('button', { name: 'Run' })).toBeVisible();
  });

  it('notMatchingStillOffersActions', async () => {
    open({
      [`GET ${ACTIVE}`]: ok({
        ...CAPTURED,
        matched: false,
        conditions: [{ ...CAPTURED.conditions[0], actual: false, passed: false }],
      }),
    });
    expect(await screen.findByText('✖ Chat is new · saw no')).toBeVisible();
    expect(screen.getByText('The rule does not match: live, its actions would not run on this event.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Run' })).toBeVisible();
  });

  it('testAgainAndDone', async () => {
    const again = open({ [`GET ${ACTIVE}`]: ok(ALL_DONE), [`POST ${X1}/again`]: ok(WAITING) });
    await again.user.click(await screen.findByRole('button', { name: 'Test again' }));
    await waitFor(() => expect(callsTo(again.f, `POST ${X1}/again`)).toBe(1));
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    again.unmount();

    const done = open({
      [`GET ${ACTIVE}`]: ok(ALL_DONE),
      [`POST ${X1}/end`]: ok({ ...ALL_DONE, status: 'ENDED', endReason: 'DONE' }),
    });
    await done.user.click(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(callsTo(done.f, `POST ${X1}/end`)).toBe(1));
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent('/automations/r1'));
    expect(screen.getByLabelText('Location')).not.toHaveTextContent('/test');
  });

  it('reloadResumesTheActiveTest', async () => {
    open({ [`GET ${ACTIVE}`]: ok(CAPTURED) });
    expect(await screen.findByRole('heading', { name: 'The event' })).toBeVisible();
    expect(screen.getByText('Hello')).toBeVisible();
    expect(screen.getByText('Main line')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Choose the test contact' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start test' })).toBeNull();
  });

  it('anotherManagersTestIsNotResumed', async () => {
    const theirs: AutomationTest = { ...CAPTURED, id: 'x9', startedBy: { id: 'u9', name: 'Demo Admin' } };
    const { f, user } = open({
      [`GET ${ACTIVE}`]: ok(theirs),
      [`POST ${AUTOMATIONS_BASE}/tests/x9/end`]: ok({ ...theirs, status: 'ENDED', endReason: 'DONE' }),
    });
    expect(await screen.findByText('Demo Admin is testing this rule.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Choose the test contact' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'The event' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check next condition' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'End that test' }));
    await waitFor(() => expect(callsTo(f, `POST ${AUTOMATIONS_BASE}/tests/x9/end`)).toBe(1));
    await waitFor(() => expect(screen.queryByText('Demo Admin is testing this rule.')).toBeNull());
    expect(callsTo(f, `POST ${TESTS}`)).toBe(0);
    expect(screen.getByRole('heading', { name: 'Choose the test contact' })).toBeVisible();
  });

  it('capturedTestIsKeptAlive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { f } = open({ [`GET ${ACTIVE}`]: ok(CAPTURED), [`GET ${X1}`]: ok(CAPTURED) }, { fake: true });
    expect(await screen.findByRole('heading', { name: 'The event' })).toBeVisible();
    await advance(59000);
    expect(callsTo(f, `GET ${X1}`)).toBe(0);
    await advance(1000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    await advance(30000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    await advance(30000);
    expect(callsTo(f, `GET ${X1}`)).toBe(2);
  });

  it('aStepOnAnEndedTestShowsWhyItEnded', async () => {
    const { f, user } = open({
      [`GET ${ACTIVE}`]: ok(CAPTURED),
      [`POST ${X1}/actions/0/run`]: {
        status: 409,
        body: { code: 'AUTOMATION_TEST_STATE', message: 'The test has ended' },
      },
      [`GET ${X1}`]: ok({ ...CAPTURED, status: 'ENDED', endReason: 'IDLE' }),
    });
    await user.click(await screen.findByRole('button', { name: 'Run' }));
    expect(await screen.findByText('The test ended: nothing happened for 30 minutes.')).toBeVisible();
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
  });

  it('conditionsShowLabelsNotIds', async () => {
    const byNumber = open({
      [`GET ${ACTIVE}`]: ok({
        ...CAPTURED,
        conditions: [{ path: '0', field: 'number', operator: 'is', value: ['n1'], actual: 'n1', passed: true }],
      }),
    });
    expect(await screen.findByText('✔ Number is Main line · saw Main line')).toBeVisible();
    byNumber.unmount();

    const lane: Rule = { ...WELCOME_RULE, event: 'DEAL_LANE_CHANGED', conditions: null, actions: [] };
    open({
      [`GET ${RULE}`]: ok(lane),
      [`GET ${ACTIVE}`]: ok({
        ...CAPTURED,
        event: 'DEAL_LANE_CHANGED',
        conditions: [
          { path: '0', field: 'toLane', operator: 'is', value: ['s3'], actual: 's3', passed: true },
          { path: '1', field: 'toLane.type', operator: 'is', value: ['WON'], actual: 'WON', passed: true },
        ],
        conditionCount: 2,
      }),
    });
    expect(await screen.findByText('✔ Moved into lane is Sales › Won · saw Sales › Won')).toBeVisible();
    expect(screen.getByText('✔ Lane type is Won · saw Won')).toBeVisible();
    expect(screen.queryByText(/saw s3/)).toBeNull();
  });

  it('idleEndStopsPollingAndSaysWhy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { f, user } = open({ [`GET ${ACTIVE}`]: ok(WAITING), [`GET ${X1}`]: ok(ENDED_IDLE) }, { fake: true });
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    await advance(2000);
    expect(await screen.findByText('The test ended: nothing happened for 30 minutes.')).toBeVisible();
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    await advance(2000);
    await advance(2000);
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Start a new test' }));
    expect(await screen.findByRole('heading', { name: 'Choose the test contact' })).toBeVisible();
  });

  it('someoneElsesTestCanBeEnded', async () => {
    const running: MockResponse = {
      status: 409,
      body: {
        code: 'AUTOMATION_TEST_RUNNING',
        message: 'Demo Admin is testing this rule',
        testId: 'x9',
        startedById: 'u9',
        startedByName: 'Demo Admin',
      },
    };
    const { f, user } = open({
      [`POST ${TESTS}`]: inTurn(running, { status: 201, body: WAITING }),
      [`POST ${AUTOMATIONS_BASE}/tests/x9/end`]: ok({ ...WAITING, id: 'x9', status: 'ENDED', endReason: 'DONE' }),
    });
    await user.click(await screen.findByRole('radio', { name: 'A number that has never messaged you' }));
    await user.type(screen.getByRole('textbox', { name: 'Phone number, country code first' }), '919811100009');
    await user.click(await startButton());
    expect(await screen.findByText('Demo Admin is testing this rule.')).toBeVisible();
    expect(screen.queryByText(WAIT_MESSAGE)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'End that test' }));
    await waitFor(() => expect(callsTo(f, `POST ${AUTOMATIONS_BASE}/tests/x9/end`)).toBe(1));
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    expect(callsTo(f, `POST ${TESTS}`)).toBe(2);
    expect(requestTo(f, `POST ${TESTS}`, 1)?.body).toEqual({
      contactId: null,
      phone: '919811100009',
      treatAsNew: false,
    });
    expect(screen.queryByText('Demo Admin is testing this rule.')).toBeNull();
  });

  it('ownRunningTestIsResumed', async () => {
    const { f, user } = open({
      [`POST ${TESTS}`]: {
        status: 409,
        body: { code: 'AUTOMATION_TEST_RUNNING', testId: 'x1', startedById: 'u4', startedByName: 'Meera Manager' },
      },
      [`GET ${X1}`]: ok(CAPTURED),
    });
    await user.click(await screen.findByRole('radio', { name: 'A number that has never messaged you' }));
    await user.type(screen.getByRole('textbox', { name: 'Phone number, country code first' }), '919811100009');
    await user.click(await startButton());
    expect(await screen.findByRole('heading', { name: 'The event' })).toBeVisible();
    expect(callsTo(f, `GET ${X1}`)).toBe(1);
    expect(screen.queryByText('Meera Manager is testing this rule.')).toBeNull();
  });

  it('changingTheSearchDropsThePickedContact', async () => {
    const { f, user } = open({
      [`GET ${CONTACTS}`]: inTurn(ok([ASHA, HIDDEN]), ok([HIDDEN])),
      [`POST ${TESTS}`]: { status: 201, body: WAITING },
    });
    const search = await screen.findByRole('textbox', { name: 'Search contacts' });
    await user.type(search, 'a');
    await user.click(await screen.findByRole('radio', { name: 'Asha · +919811100001 · on Main line' }));
    expect(await startButton()).toBeEnabled();
    await user.clear(search);
    await user.type(search, 'ravi');
    expect(await startButton()).toBeDisabled();
    await waitFor(() => expect(callsTo(f, `GET ${CONTACTS}`)).toBe(2));
    const ravi = await screen.findByRole('radio', { name: 'Ravi · Number hidden · on Main line' });
    expect(screen.queryByRole('radio', { name: 'Asha · +919811100001 · on Main line' })).toBeNull();
    expect(await startButton()).toBeDisabled();
    await user.click(ravi);
    await user.click(await startButton());
    await waitFor(() => expect(callsTo(f, `POST ${TESTS}`)).toBe(1));
    expect(requestTo(f, `POST ${TESTS}`)?.body).toEqual({ contactId: 'c2', phone: null, treatAsNew: false });
  });

  it('preflightFailureKeepsTheActiveTest', async () => {
    const { f, user } = open({
      [`GET ${ACTIVE}`]: ok(WAITING),
      [`GET ${PREFLIGHT}`]: inTurn({ status: 500, body: {} }, { status: 500, body: {} }, ok(READY)),
      [`POST ${X1}/end`]: ok({ ...WAITING, status: 'ENDED', endReason: 'DONE' }),
    });
    // the open test resumes although the preflight failed
    expect(await screen.findByText(WAIT_MESSAGE)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Stop test' }));
    await user.click(await screen.findByRole('button', { name: 'Start a new test' }));
    expect(await screen.findByRole('heading', { name: 'Choose the test contact' })).toBeVisible();
    await waitFor(() => expect(callsTo(f, `GET ${PREFLIGHT}`)).toBe(2));
    expect(await screen.findByText('The checks before testing could not be loaded.')).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'A number that has never messaged you' }));
    await user.type(screen.getByRole('textbox', { name: 'Phone number, country code first' }), '919811100009');
    expect(await startButton()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start test' })).toBeEnabled());
    expect(screen.queryByText('The checks before testing could not be loaded.')).toBeNull();
  });

  it('laneChangeTestNeedsAContact', async () => {
    const lane: Rule = {
      ...WELCOME_RULE,
      event: 'DEAL_LANE_CHANGED',
      conditions: null,
      actions: [{ type: 'SEND_TEMPLATE', templateId: 'tp1', values: {} }],
    };
    const { f, user } = open({
      [`GET ${RULE}`]: ok(lane),
      [`GET ${CONTACTS}`]: ok([ASHA]),
      [`POST ${TESTS}`]: { status: 201, body: { ...WAITING, event: 'DEAL_LANE_CHANGED', treatAsNew: false } },
    });
    const search = await screen.findByRole('textbox', { name: 'Search contacts' });
    expect(screen.queryByRole('radio', { name: 'A number that has never messaged you' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Treat this chat as new' })).toBeNull();
    await user.type(search, 'asha');
    await user.click(await screen.findByRole('radio', { name: 'Asha · +919811100001 · on Main line' }));
    await user.click(await startButton());
    await waitFor(() => expect(callsTo(f, `POST ${TESTS}`)).toBe(1));
    expect(requestTo(f, `POST ${TESTS}`)?.body).toEqual({ contactId: 'c1', phone: null, treatAsNew: false });
    expect(await screen.findByText("Move one of Asha's deals to another lane.")).toBeVisible();
  });

  it('preflightBlocksStart', async () => {
    const blocked: Preflight = {
      canRun: false,
      checks: [
        { level: 'BLOCKER', actionIndex: null, message: "No connected extension on any of the brand's numbers" },
      ],
    };
    const { f, user } = open({ [`GET ${PREFLIGHT}`]: inTurn(ok(blocked), ok(READY)) });
    expect(await screen.findByText('Fix these before testing')).toBeVisible();
    expect(screen.getByText("No connected extension on any of the brand's numbers")).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'A number that has never messaged you' }));
    await user.type(screen.getByRole('textbox', { name: 'Phone number, country code first' }), '919811100009');
    expect(await startButton()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(callsTo(f, `GET ${PREFLIGHT}`)).toBe(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start test' })).toBeEnabled());
    expect(screen.queryByText('Fix these before testing')).toBeNull();
  });

  it('preflightWarningsAreListed', async () => {
    const warned: Preflight = {
      canRun: true,
      checks: [
        { level: 'WARNING', actionIndex: 0, message: 'Send template really sends “Welcome” to the test contact' },
        { level: 'WARNING', actionIndex: 1, message: "Assign chat really reassigns the test contact's chat" },
      ],
    };
    open({ [`GET ${PREFLIGHT}`]: ok(warned) });
    expect(await screen.findByText('This will really happen to the test contact')).toBeVisible();
    expect(screen.getByText('Send template really sends “Welcome” to the test contact')).toBeVisible();
    expect(screen.getByText("Assign chat really reassigns the test contact's chat")).toBeVisible();
    expect(screen.queryByText('Fix these before testing')).toBeNull();
  });

  it('replayReusesTheEvent', async () => {
    const replayed: AutomationTest = {
      ...CAPTURED,
      conditions: [],
      matched: null,
      actions: CAPTURED_TEST.actions,
      nextAction: 0,
    };
    const { f, user } = open({ [`GET ${ACTIVE}`]: ok(ALL_DONE), [`POST ${X1}/replay`]: ok(replayed) });
    expect(await screen.findByRole('button', { name: 'Replay this event' })).toBeVisible();
    expect(
      screen.getByText('Runs the same event again from its first condition. The actions really happen again.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
    expect(screen.getByText('✔ Chat is new · saw yes')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Replay this event' }));
    await waitFor(() => expect(callsTo(f, `POST ${X1}/replay`)).toBe(1));
    expect(await screen.findByRole('button', { name: 'Check next condition' })).toBeVisible();
    expect(screen.queryByText('✔ Chat is new · saw yes')).toBeNull();
    expect(actionRow(1).getByRole('button', { name: 'Run' })).toBeVisible();
    expect(callsTo(f, `GET ${X1}`)).toBe(0);
  });

  it('onlyDraftsCanBeTested', async () => {
    open({ [`GET ${RULE}`]: ok({ ...PUBLISHED_RULE, id: 'r1' }) });
    expect(await screen.findByText('Only drafts can be tested.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to the rule' })).toHaveAttribute('href', '/automations/r1');
    expect(screen.queryByRole('button', { name: 'Start test' })).toBeNull();
  });

  it('needsAutomationManage', async () => {
    open({}, { me: VIEW_ONLY });
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });
});
