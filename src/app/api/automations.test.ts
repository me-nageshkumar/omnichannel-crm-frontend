import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkNextCondition,
  createRule,
  deleteRule,
  endTest,
  getActiveTest,
  getTestPreflight,
  listEvents,
  replayTest,
  runTestAction,
  skipTestAction,
  testAgain,
  type RuleRequest,
} from '@app/api/automations';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';

const B = '/api/workspaces/w1/automations';

afterEach(() => vi.unstubAllGlobals());

describe('automations api', () => {
  it('createRulePostsTheRequest', async () => {
    const fetch = mockFetch({ [`POST ${B}/rules`]: { status: 201, body: { id: 'r1' } } });
    const body: RuleRequest = {
      name: 'Welcome',
      description: null,
      event: 'MESSAGE_RECEIVED',
      priority: null,
      conditions: null,
      actions: [{ type: 'ADD_TO_CRM' }],
    };
    await createRule('tok', 'w1', body);
    expect(requestTo(fetch, `POST ${B}/rules`)?.body).toEqual(body);
  });

  it('listEventsBuildsQuery', async () => {
    const fetch = mockFetch({ [`GET ${B}/events`]: { status: 200, body: { items: [], total: 0, page: 2 } } });
    await listEvents('tok', 'w1', {
      page: 2,
      to: '2026-11-02T00:00:00Z',
      from: '2026-11-01T00:00:00Z',
      contactId: 'c1',
      ruleId: 'r1',
      kind: 'DEAL_LANE_CHANGED',
    });
    await listEvents('tok', 'w1');
    expect(String(fetch.mock.calls[0][0])).toBe(
      `${B}/events?kind=DEAL_LANE_CHANGED&ruleId=r1&contactId=c1&from=2026-11-01T00%3A00%3A00Z&to=2026-11-02T00%3A00%3A00Z&page=2`,
    );
    expect(String(fetch.mock.calls[1][0])).toBe(`${B}/events`);
  });

  it('activeTestIsUndefinedOn204', async () => {
    mockFetch({ [`GET ${B}/rules/r1/tests/active`]: { status: 204 } });
    expect(await getActiveTest('tok', 'w1', 'r1')).toBeUndefined();
    mockFetch({ [`GET ${B}/rules/r1/tests/active`]: { status: 200, body: { id: 't1' } } });
    expect(await getActiveTest('tok', 'w1', 'r1')).toEqual({ id: 't1' });
  });

  it('testActionPaths', async () => {
    const keys = [
      `POST ${B}/tests/x/actions/1/run`,
      `POST ${B}/tests/x/actions/1/skip`,
      `POST ${B}/tests/x/check`,
      `POST ${B}/tests/x/again`,
      `POST ${B}/tests/x/end`,
      `POST ${B}/tests/x/replay`,
    ];
    const routes = Object.fromEntries(keys.map((k) => [k, { status: 200, body: { id: 'x' } }]));
    const fetch = mockFetch({
      ...routes,
      [`GET ${B}/rules/r1/tests/preflight`]: { status: 200, body: { canRun: true, checks: [] } },
    });
    await runTestAction('tok', 'w1', 'x', 1);
    await skipTestAction('tok', 'w1', 'x', 1);
    await checkNextCondition('tok', 'w1', 'x');
    await testAgain('tok', 'w1', 'x');
    await endTest('tok', 'w1', 'x');
    await replayTest('tok', 'w1', 'x');
    expect(await getTestPreflight('tok', 'w1', 'r1')).toEqual({ canRun: true, checks: [] });
    for (const k of keys) expect(callsTo(fetch, k)).toBe(1);
    expect(callsTo(fetch, `GET ${B}/rules/r1/tests/preflight`)).toBe(1);
  });

  it('deleteRuleSendsDelete', async () => {
    const fetch = mockFetch({ [`DELETE ${B}/rules/r1`]: { status: 204 } });
    await deleteRule('tok', 'w1', 'r1');
    expect(callsTo(fetch, `DELETE ${B}/rules/r1`)).toBe(1);
  });
});
