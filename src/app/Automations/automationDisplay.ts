import type { AutomationOptions, AutomationTest, EventData, EventKind, Run, StepView } from '@app/api/automations';
import { EVENTS, choicesFor } from './automationModel';

export const statusLabel = (s: 'DRAFT' | 'PUBLISHED'): string => (s === 'PUBLISHED' ? 'Published' : 'Draft');
export const statusColor = (s: 'DRAFT' | 'PUBLISHED'): 'grey' | 'green' => (s === 'PUBLISHED' ? 'green' : 'grey');

export const eventLabel = (k: EventKind): string => EVENTS.find((e) => e.kind === k)?.label ?? k;

type Outcome = NonNullable<StepView['outcome']>;

const OUTCOMES: Record<Outcome, { label: string; color: 'green' | 'grey' | 'red' | 'orange' | 'yellow' }> = {
  DONE: { label: 'Done', color: 'green' },
  SKIPPED: { label: 'Skipped', color: 'grey' },
  FAILED: { label: 'Failed', color: 'red' },
  RETRYING: { label: 'Retrying', color: 'orange' },
  INTERRUPTED: { label: 'Interrupted', color: 'yellow' },
};

export const outcomeLabel = (o: StepView['outcome']): string => (o ? OUTCOMES[o].label : '');
export const outcomeColor = (o: StepView['outcome']): 'green' | 'grey' | 'red' | 'orange' | 'yellow' =>
  o ? OUTCOMES[o].color : 'grey';

const RUN_STATUS: Record<Run['status'], string> = {
  RUNNING: 'Running',
  TESTING: 'Testing',
  DONE: 'Done',
  FAILED: 'Failed',
  INTERRUPTED: 'Interrupted',
};
export const runStatusLabel = (s: Run['status']): string => RUN_STATUS[s];

/** A condition's actual value in words. */
export function actualText(v: unknown): string {
  if (v === null || v === undefined) return 'empty';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/** The fields whose value is an id or a code the options name. */
const CHOICE_FIELDS = ['message.type', 'number', 'pipeline', 'toLane', 'fromLane', 'toLane.type', 'deal.owner'];

/** The name the captured event gives an id the options no longer hold (a removed number, lane or agent). */
function eventName(field: string, id: string, data: EventData | null): string | undefined {
  if (!data) return undefined;
  switch (field) {
    case 'number':
      return data.number?.id === id ? (data.number.label ?? '+' + data.number.number) : undefined;
    case 'pipeline':
      return data.pipeline?.id === id ? data.pipeline.name : undefined;
    case 'toLane':
    case 'fromLane': {
      const lane = [data.toLane, data.fromLane].find((l) => l?.id === id);
      return lane?.name ?? undefined;
    }
    case 'deal.owner':
      return data.deal?.owner?.id === id ? data.deal.owner.name : undefined;
    default:
      return undefined;
  }
}

/**
 * A condition's actual value in words, by field: ids and codes of choice fields (numbers, pipelines, lanes, owners,
 * message and lane types) become their labels, falling back to the names in the captured event; everything else
 * reads as {@link actualText}.
 */
export function actualLabel(field: string, actual: unknown, o: AutomationOptions, data: EventData | null): string {
  if (CHOICE_FIELDS.indexOf(field) < 0) return actualText(actual);
  const choices = choicesFor(field, o);
  const one = (v: unknown): string => {
    const id = String(v);
    return choices.find((c) => c.value === id)?.label ?? eventName(field, id, data) ?? id;
  };
  if (actual === null || actual === undefined || typeof actual === 'boolean') return actualText(actual);
  if (Array.isArray(actual)) return actual.length === 0 ? actualText(null) : actual.map(one).join(', ');
  return one(actual);
}

/** What the tester has to do for the test to move on. */
export function waitingText(t: AutomationTest, _o: AutomationOptions): string {
  if (t.event === 'DEAL_LANE_CHANGED') return `Move one of ${t.target.name}'s deals to another lane.`;
  const who = t.target.name ?? '+' + t.target.phone;
  const numbers = t.numbers.map((n) => n.label ?? '+' + n.number).join(' or ');
  return `Send a message from ${who}'s phone to ${numbers}.`;
}

export function endedText(r: AutomationTest['endReason']): string {
  switch (r) {
    case 'IDLE':
      return 'The test ended: nothing happened for 30 minutes.';
    case 'RULE_PUBLISHED':
      return 'The test ended because the rule was published.';
    case 'RULE_DELETED':
      return 'The test ended because the rule was deleted.';
    default:
      return 'The test is done.';
  }
}
