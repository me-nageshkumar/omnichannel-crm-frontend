import type { NodeOutput } from '@app/Chatbots/nodeCatalog';

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** True when the exit condition has at least one rule (an empty group is "no condition", as on the server). */
export function hasExitCondition(s: Any): boolean {
  const c = s.exitCondition as Any | null | undefined;
  return Boolean(c && Array.isArray(c.rules) && c.rules.length > 0);
}

/**
 * The AI node's outputs, exactly as the server's AiExecutor.outputs: SINGLE → `next` (no outcomes) or one
 * `outcome:<id>` per outcome, then `failure`; CONVERSATION → outcomes, `exitWord` (exit words set), `exitCondition`
 * (a condition set), `maxTurns`, `failure`.
 */
export function aiOutputs(s: Any): NodeOutput[] {
  const outcomes = ((s.outcomes as Any[]) ?? [])
    .filter((o) => o && typeof o.id === 'string' && o.id !== '')
    .map((o) => ({ id: `outcome:${o.id}`, label: String(o.label || o.id) }));
  const out: NodeOutput[] = [];
  if (s.mode === 'CONVERSATION') {
    out.push(...outcomes);
    if (((s.exitWords as unknown[]) ?? []).length > 0) out.push({ id: 'exitWord', label: 'Exit word' });
    if (hasExitCondition(s)) out.push({ id: 'exitCondition', label: 'Exit condition' });
    out.push({ id: 'maxTurns', label: 'Max turns' });
  } else if (outcomes.length > 0) {
    out.push(...outcomes);
  } else {
    out.push({ id: 'next', label: 'Next' });
  }
  out.push({ id: 'failure', label: 'Failure' });
  return out;
}

/** The variables the AI node writes under its name. */
export function aiProduces(s: Any): string[] {
  const base = ['reply', 'outcome', 'turns', 'usage.inputTokens', 'usage.outputTokens', 'conversationId', 'errorCode'];
  const fields = ((s.collect as Any[]) ?? [])
    .filter((f) => f && typeof f.key === 'string' && f.key !== '')
    .map((f) => `fields.${f.key}`);
  const json = (s.replyFormat as Any | undefined)?.type === 'JSON' ? ['json'] : [];
  return [...base, ...fields, ...json];
}
