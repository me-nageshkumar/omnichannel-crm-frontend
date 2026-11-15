import type { SettingField, SettingsLayer } from '@app/api/chatbots';

/** The nine settings, in the order the backend lists them (spec 2026-11-14 §3). */
export const FIELDS: SettingField[] = [
  'reminderOn',
  'reminderAfterMinutes',
  'reminderMessage',
  'endAfterMinutes',
  'endMessage',
  'invalidReplyRetries',
  'retryMessage',
  'giveUpMessage',
  'stopOnAgentReply',
];

/** The two messages that may be set to "send no message" (`''`). */
export const OPTIONAL_MESSAGES: SettingField[] = ['endMessage', 'giveUpMessage'];
const BOOLEANS: SettingField[] = ['reminderOn', 'stopOnAgentReply'];
const NUMBERS: SettingField[] = ['reminderAfterMinutes', 'endAfterMinutes', 'invalidReplyRetries'];
const TEXTS: SettingField[] = ['reminderMessage', 'endMessage', 'retryMessage', 'giveUpMessage'];

export const LIMITS = { reminder: [1, 1440], end: [5, 2880], retries: [0, 5] } as const;
const RANGE: Partial<Record<SettingField, { lim: readonly [number, number]; msg: string }>> = {
  reminderAfterMinutes: { lim: LIMITS.reminder, msg: 'must be 1 to 1440 minutes' },
  endAfterMinutes: { lim: LIMITS.end, msg: 'must be 5 to 2880 minutes' },
  invalidReplyRetries: { lim: LIMITS.retries, msg: 'must be 0 to 5' },
};
const MAX_TEXT = 1024;

export const REMINDER_WARNING = 'The reminder comes at or after the end, so it will never be sent.';

export const EMPTY_LAYER: SettingsLayer = {
  reminderOn: null,
  reminderAfterMinutes: null,
  reminderMessage: null,
  endAfterMinutes: null,
  endMessage: null,
  invalidReplyRetries: null,
  retryMessage: null,
  giveUpMessage: null,
  stopOnAgentReply: null,
};

/** One field being edited: inherited, set to a value (booleans as 'true'/'false'), or "send no message". */
export type FieldDraft = { kind: 'inherit' } | { kind: 'set'; text: string } | { kind: 'none' };
export type LayerDraft = Record<SettingField, FieldDraft>;

const INHERIT: FieldDraft = { kind: 'inherit' };

export function toDraft(layer: SettingsLayer): LayerDraft {
  const out = {} as LayerDraft;
  for (const f of FIELDS) {
    const v = layer[f];
    if (v === null || v === undefined) out[f] = INHERIT;
    else if (v === '' && OPTIONAL_MESSAGES.includes(f)) out[f] = { kind: 'none' };
    else out[f] = { kind: 'set', text: String(v) };
  }
  return out;
}

export function fromDraft(d: LayerDraft): SettingsLayer {
  const out: Record<string, unknown> = { ...EMPTY_LAYER };
  for (const f of FIELDS) {
    const fd = d[f];
    if (fd.kind === 'none') out[f] = OPTIONAL_MESSAGES.includes(f) ? '' : null;
    else if (fd.kind === 'inherit' || fd.text.trim() === '') out[f] = null;
    else if (BOOLEANS.includes(f)) out[f] = fd.text === 'true';
    else if (NUMBERS.includes(f)) out[f] = Number(fd.text);
    else out[f] = fd.text.trim();
  }
  return out as unknown as SettingsLayer;
}

/** The value a run would use: this layer's where it sets one, else the inherited one. */
export function effective(own: SettingsLayer, inherited: SettingsLayer): SettingsLayer {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) out[f] = own[f] ?? inherited[f];
  return out as unknown as SettingsLayer;
}

/** Field errors, worded as the backend's; `complete` (the platform layer) also requires every non-optional field. */
export function layerProblems(d: LayerDraft, complete: boolean): Partial<Record<SettingField, string>> {
  const layer = fromDraft(d);
  const out: Partial<Record<SettingField, string>> = {};
  for (const f of NUMBERS) {
    const v = layer[f] as number | null;
    const r = RANGE[f];
    if (v !== null && r && (!Number.isInteger(v) || v < r.lim[0] || v > r.lim[1])) out[f] = r.msg;
  }
  for (const f of TEXTS) {
    const v = layer[f] as string | null;
    if (v !== null && v.length > MAX_TEXT) out[f] = 'must be at most 1024 characters';
  }
  if (complete) {
    for (const f of FIELDS) {
      if (!OPTIONAL_MESSAGES.includes(f) && layer[f] === null && !out[f]) out[f] = 'is required';
    }
  }
  return out;
}

/** The warning (not an error) when the effective reminder can never go out. */
export function reminderWarning(eff: SettingsLayer): string | null {
  if (!eff.reminderOn || eff.reminderAfterMinutes === null || eff.endAfterMinutes === null) return null;
  return eff.reminderAfterMinutes >= eff.endAfterMinutes ? REMINDER_WARNING : null;
}
