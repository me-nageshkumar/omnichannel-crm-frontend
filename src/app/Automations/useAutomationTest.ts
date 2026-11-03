import * as React from 'react';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import {
  checkNextCondition,
  endTest,
  getActiveTest,
  getTest,
  getTestPreflight,
  replayTest,
  runTestAction,
  skipTestAction,
  startTest,
  testAgain,
} from '@app/api/automations';
import type { AutomationTest, Preflight, TestStartRequest } from '@app/api/automations';
import { useSession } from '@app/session/SessionContext';

/** How often a waiting test is fetched; every fetch also keeps the test alive on the server. */
export const POLL_MS = 2000;
/** How often a captured test is fetched while the page is open: the fetch is its heartbeat, so it is not idle-ended. */
export const HEARTBEAT_MS = 60000;

/** Someone else's open test of the rule, which stopped this user's start. */
export interface OtherTest {
  testId: string;
  startedByName: string;
}

export interface AutomationTestState {
  test: AutomationTest | undefined;
  preflight: Preflight | undefined;
  /** The last preflight load failed (the preflight is then undefined). */
  preflightError: string | null;
  loading: boolean;
  error: string | null;
  /** A step call is on its way. */
  busy: boolean;
  /** Set when a start found another user's test of the rule. */
  otherTest: OtherTest | null;
  /** Set when the server refused because the rule is published. */
  published: boolean;
  reloadPreflight(): Promise<void>;
  start(body: TestStartRequest): Promise<void>;
  /** Ends {@link otherTest}, then (when a start found it) starts again with the request it stopped. */
  endOtherTest(): Promise<void>;
  check(): Promise<void>;
  run(index: number): Promise<void>;
  skip(index: number): Promise<void>;
  again(): Promise<void>;
  replay(): Promise<void>;
  /** Resolves true once the test has ended. */
  end(): Promise<boolean>;
  /** Forgets an ended test, so a new one can be started. */
  clear(): void;
}

const describe = (e: unknown): string => (e instanceof ApiError && e.serverMessage) || messageFor(e);

export const PREFLIGHT_FAILED = 'The checks before testing could not be loaded.';
export const TEST_GONE = 'This test is no longer open. Reload the page to see where it stands.';

/** A poll the server refused (the test is gone, or no longer the user's to see): asking again will not help. */
const refusedPoll = (e: unknown): boolean =>
  e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;

/** The open test named by a start refused with AUTOMATION_TEST_RUNNING, or null. */
function runningTest(e: unknown): { testId: string; startedById: string; startedByName: string } | null {
  if (!(e instanceof ApiError) || e.code !== 'AUTOMATION_TEST_RUNNING' || !e.extra?.testId) return null;
  return {
    testId: e.extra.testId,
    startedById: e.extra.startedById ?? '',
    startedByName: e.extra.startedByName ?? 'Someone',
  };
}

/**
 * One rule's test: the user's own open test (resumed on mount; another manager's is offered to end instead) and the
 * preflight, loaded independently. A WAITING test is fetched {@link POLL_MS} after each answer (never two at once), a
 * CAPTURED one every {@link HEARTBEAT_MS} to keep it alive; a poll the server refuses stops the polling with an
 * error, other failures are retried. Every step call replaces the test with the server's answer, and an answer
 * to a poll that was on its way meanwhile is dropped.
 */
export function useAutomationTest(ruleId: string): AutomationTestState {
  const { token, workspace, user } = useSession();
  const t = token as string;
  const ws = workspace?.id ?? '';
  const [test, setTest] = React.useState<AutomationTest | undefined>(undefined);
  const [preflight, setPreflight] = React.useState<Preflight | undefined>(undefined);
  const [preflightError, setPreflightError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [otherTest, setOtherTest] = React.useState<(OtherTest & { body: TestStartRequest | null }) | null>(null);
  const [published, setPublished] = React.useState(false);
  // Bumped when a step call starts (and on unmount): a poll sent before it no longer counts.
  const generation = React.useRef(0);
  // The latest step call: only its answer is shown.
  const latestStep = React.useRef(0);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);

  React.useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    getActiveTest(token, ws, ruleId).then(
      (active) => {
        if (!live) return;
        if (active && active.startedBy.id !== user?.id) {
          // another manager's test is theirs to step through: offer to end it instead
          setOtherTest({ testId: active.id, startedByName: active.startedBy.name, body: null });
        } else setTest(active ?? undefined);
        setLoading(false);
      },
      (e) => {
        if (!live) return;
        setError(describe(e));
        setLoading(false);
      },
    );
    getTestPreflight(token, ws, ruleId).then(
      (checks) => {
        if (!live) return;
        setPreflight(checks);
        setPreflightError(null);
      },
      () => {
        if (live) setPreflightError(PREFLIGHT_FAILED);
      },
    );
    return () => {
      live = false;
    };
    // the user is read once the active test arrives; a change of user signs out and remounts the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ws, ruleId]);

  // WAITING is fetched often (its answer is what the page waits for), CAPTURED slowly to keep it alive
  const pollId = test && test.status !== 'ENDED' ? test.id : null;
  const every = test?.status === 'WAITING' ? POLL_MS : HEARTBEAT_MS;
  React.useEffect(() => {
    if (!pollId || !token) return undefined;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      timer = setTimeout(() => {
        const sent = generation.current;
        getTest(token, ws, pollId).then(
          (next) => {
            if (!live) return;
            if (sent === generation.current) setTest(next);
            // a test that moved on re-runs this effect, whose clean-up clears this timer
            poll();
          },
          (e) => {
            if (!live) return;
            if (refusedPoll(e)) setError(e instanceof ApiError && e.status === 404 ? TEST_GONE : describe(e));
            else poll();
          },
        );
      }, every);
    };
    poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [pollId, every, token, ws]);

  /**
   * Runs one call that answers with the test and shows its answer; a failure goes to {@code refused} when it takes
   * it (returns true), otherwise to the error.
   */
  const step = async (fn: () => Promise<AutomationTest>, refused?: (e: unknown) => boolean): Promise<boolean> => {
    setBusy(true);
    setError(null);
    generation.current += 1;
    const request = ++latestStep.current;
    try {
      const next = await fn();
      if (mounted.current && request === latestStep.current) setTest(next);
      return true;
    } catch (e) {
      if (mounted.current && !refused?.(e)) setError(describe(e));
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const start = async (body: TestStartRequest): Promise<void> => {
    setOtherTest(null);
    await step(
      async () => {
        try {
          return await startTest(t, ws, ruleId, body);
        } catch (e) {
          const other = runningTest(e);
          // this user's own test (another tab, or from before a reload) is resumed
          if (other && other.startedById === user?.id) return getTest(t, ws, other.testId);
          throw e;
        }
      },
      (e) => {
        const other = runningTest(e);
        if (other) setOtherTest({ testId: other.testId, startedByName: other.startedByName, body });
        if (e instanceof ApiError && e.code === 'AUTOMATION_RULE_PUBLISHED') setPublished(true);
        return other !== null;
      },
    );
  };

  const endOtherTest = async (): Promise<void> => {
    if (!otherTest) return;
    setBusy(true);
    setError(null);
    try {
      await endTest(t, ws, otherTest.testId);
    } catch (e) {
      if (mounted.current) {
        setError(describe(e));
        setBusy(false);
      }
      return;
    }
    if (!mounted.current) return;
    if (otherTest.body) {
      await start(otherTest.body);
    } else {
      setOtherTest(null);
      setBusy(false);
    }
  };

  const reloadPreflight = async (): Promise<void> => {
    try {
      const checks = await getTestPreflight(t, ws, ruleId);
      if (!mounted.current) return;
      setPreflight(checks);
      setPreflightError(null);
    } catch {
      if (!mounted.current) return;
      // a start must not rest on checks that could not be made again
      setPreflight(undefined);
      setPreflightError(PREFLIGHT_FAILED);
    }
  };

  /**
   * A step on the open test; resolves true when the server took it. A test that moved on meanwhile (it ended, e.g.
   * idle) is fetched again, so the page shows why instead of the stale steps.
   */
  const on = (fn: (id: string) => Promise<AutomationTest>): Promise<boolean> => {
    if (!test) return Promise.resolve(false);
    const id = test.id;
    return step(
      () => fn(id),
      (e) => {
        if (!(e instanceof ApiError && e.code === 'AUTOMATION_TEST_STATE')) return false;
        const sent = generation.current;
        getTest(t, ws, id).then(
          (fresh) => {
            if (mounted.current && sent === generation.current) setTest(fresh);
          },
          () => {
            if (mounted.current) setError(describe(e));
          },
        );
        return true;
      },
    );
  };
  const onVoid = async (fn: (id: string) => Promise<AutomationTest>): Promise<void> => {
    await on(fn);
  };

  return {
    test,
    preflight,
    preflightError,
    loading,
    error,
    busy,
    otherTest: otherTest && { testId: otherTest.testId, startedByName: otherTest.startedByName },
    published,
    reloadPreflight,
    start,
    endOtherTest,
    check: () => onVoid((id) => checkNextCondition(t, ws, id)),
    run: (index) => onVoid((id) => runTestAction(t, ws, id, index)),
    skip: (index) => onVoid((id) => skipTestAction(t, ws, id, index)),
    again: () => onVoid((id) => testAgain(t, ws, id)),
    replay: () => onVoid((id) => replayTest(t, ws, id)),
    end: () => on((id) => endTest(t, ws, id)),
    clear: () => {
      generation.current += 1;
      latestStep.current += 1;
      setTest(undefined);
      setError(null);
      void reloadPreflight();
    },
  };
}
