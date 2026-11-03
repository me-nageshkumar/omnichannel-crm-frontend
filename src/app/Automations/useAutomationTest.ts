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

/** Someone else's open test of the rule, which stopped this user's start. */
export interface OtherTest {
  testId: string;
  startedByName: string;
}

export interface AutomationTestState {
  test: AutomationTest | undefined;
  preflight: Preflight | undefined;
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
  /** Ends {@link otherTest}, then starts again with the request it stopped. */
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
 * One rule's test: the open test (resumed on mount) and the preflight. A WAITING test is fetched every
 * {@link POLL_MS}; nothing else is polled. Every step call replaces the test with the server's answer, and an answer
 * to a poll that was on its way meanwhile is dropped.
 */
export function useAutomationTest(ruleId: string): AutomationTestState {
  const { token, workspace, user } = useSession();
  const t = token as string;
  const ws = workspace?.id ?? '';
  const [test, setTest] = React.useState<AutomationTest | undefined>(undefined);
  const [preflight, setPreflight] = React.useState<Preflight | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [otherTest, setOtherTest] = React.useState<(OtherTest & { body: TestStartRequest }) | null>(null);
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
    Promise.all([getActiveTest(token, ws, ruleId), getTestPreflight(token, ws, ruleId)]).then(
      ([active, checks]) => {
        if (!live) return;
        setTest(active ?? undefined);
        setPreflight(checks);
        setLoading(false);
      },
      (e) => {
        if (!live) return;
        setError(describe(e));
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
  }, [token, ws, ruleId]);

  const waitingId = test?.status === 'WAITING' ? test.id : null;
  React.useEffect(() => {
    if (!waitingId || !token) return undefined;
    let live = true;
    const timer = setInterval(() => {
      const sent = generation.current;
      getTest(token, ws, waitingId).then(
        (next) => {
          if (live && sent === generation.current) setTest(next);
        },
        () => undefined, // the next poll tries again
      );
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [waitingId, token, ws]);

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
    if (mounted.current) await start(otherTest.body);
  };

  const reloadPreflight = async (): Promise<void> => {
    try {
      const checks = await getTestPreflight(t, ws, ruleId);
      if (mounted.current) setPreflight(checks);
    } catch (e) {
      if (mounted.current) setError(describe(e));
    }
  };

  /** A step on the open test; resolves true when the server took it. */
  const on = (fn: (id: string) => Promise<AutomationTest>): Promise<boolean> =>
    test ? step(() => fn(test.id)) : Promise.resolve(false);
  const onVoid = async (fn: (id: string) => Promise<AutomationTest>): Promise<void> => {
    await on(fn);
  };

  return {
    test,
    preflight,
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
