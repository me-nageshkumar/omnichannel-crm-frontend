import { describe, expect, it } from 'vitest';
import type { SettingsLayer } from '@app/api/chatbots';
import {
  EMPTY_LAYER,
  FIELDS,
  effective,
  fromDraft,
  layerProblems,
  reminderWarning,
  toDraft,
} from '@app/Chatbots/settings/settingsLayers';

const PLATFORM: SettingsLayer = {
  reminderOn: false,
  reminderAfterMinutes: 30,
  reminderMessage: 'Are you still there? Reply to carry on.',
  endAfterMinutes: 120,
  endMessage: '',
  invalidReplyRetries: 2,
  retryMessage: "Sorry, I didn't get that. Please choose one of the options.",
  giveUpMessage: '',
  stopOnAgentReply: true,
  whenCompleted: 'CLOSE',
  whenAbandoned: 'ROUTE',
};

describe('settings layers', () => {
  it('roundTripsALayer', () => {
    const own: SettingsLayer = { ...EMPTY_LAYER, endAfterMinutes: 30, endMessage: '', reminderOn: true };
    const d = toDraft(own);
    expect(d.endAfterMinutes).toEqual({ kind: 'set', text: '30' });
    expect(d.endMessage).toEqual({ kind: 'none' });
    expect(d.reminderOn).toEqual({ kind: 'set', text: 'true' });
    expect(d.retryMessage).toEqual({ kind: 'inherit' });
    expect(fromDraft(d)).toEqual(own);
    expect(FIELDS).toHaveLength(11);
    expect(FIELDS.slice(-2)).toEqual(['whenCompleted', 'whenAbandoned']);
  });

  it('clearedInputIsInherited', () => {
    const d = { ...toDraft(EMPTY_LAYER), endAfterMinutes: { kind: 'set' as const, text: '' } };
    expect(fromDraft(d).endAfterMinutes).toBeNull();
    expect(layerProblems(d, false)).toEqual({});
  });

  it('untickingNoneReturnsToInherited', () => {
    const none = { ...toDraft(EMPTY_LAYER), giveUpMessage: { kind: 'none' as const } };
    expect(fromDraft(none).giveUpMessage).toBe('');
    const back = { ...none, giveUpMessage: { kind: 'inherit' as const } };
    expect(fromDraft(back).giveUpMessage).toBeNull();
  });

  it('rangesAndRequiredMessages', () => {
    const d = toDraft({
      ...EMPTY_LAYER,
      reminderAfterMinutes: 0,
      endAfterMinutes: 4,
      invalidReplyRetries: 6,
      giveUpMessage: 'x'.repeat(1025),
    });
    expect(layerProblems(d, false)).toEqual({
      reminderAfterMinutes: 'must be 1 to 1440 minutes',
      endAfterMinutes: 'must be 5 to 2880 minutes',
      invalidReplyRetries: 'must be 0 to 5',
      giveUpMessage: 'must be at most 1024 characters',
    });
    const blank = { ...toDraft(EMPTY_LAYER), retryMessage: { kind: 'set' as const, text: '  ' } };
    // a blank required message is not "inherit": the field was touched and emptied of everything but spaces
    expect(layerProblems(blank, false)).toEqual({});
    expect(fromDraft(blank).retryMessage).toBeNull();
    expect(layerProblems(toDraft({ ...EMPTY_LAYER, invalidReplyRetries: 1.5 }), false).invalidReplyRetries).toBe(
      'must be 0 to 5',
    );
  });

  it('completeLayerNeedsEveryRequiredField', () => {
    const p = layerProblems(toDraft(EMPTY_LAYER), true);
    expect(Object.keys(p).sort()).toEqual(
      [
        'reminderOn',
        'reminderAfterMinutes',
        'reminderMessage',
        'endAfterMinutes',
        'invalidReplyRetries',
        'retryMessage',
        'stopOnAgentReply',
        'whenCompleted',
        'whenAbandoned',
      ].sort(),
    );
    expect(p.retryMessage).toBe('is required');
    expect(layerProblems(toDraft(PLATFORM), true)).toEqual({});
  });

  it('effectivePrefersOwn', () => {
    const e = effective({ ...EMPTY_LAYER, endAfterMinutes: 30 }, PLATFORM);
    expect(e.endAfterMinutes).toBe(30);
    expect(e.retryMessage).toBe(PLATFORM.retryMessage);
    expect(effective({ ...EMPTY_LAYER, endMessage: '' }, { ...PLATFORM, endMessage: 'Bye' }).endMessage).toBe('');
  });

  it('reminderWarningOnlyWhenOnAndLate', () => {
    const msg = 'The reminder comes at or after the end, so it will never be sent.';
    expect(reminderWarning({ ...PLATFORM, reminderOn: true, reminderAfterMinutes: 120 })).toBe(msg);
    expect(reminderWarning({ ...PLATFORM, reminderOn: true, reminderAfterMinutes: 119 })).toBeNull();
    expect(reminderWarning({ ...PLATFORM, reminderOn: false, reminderAfterMinutes: 500 })).toBeNull();
  });

  it('a layer saved without the after-chatbot keys reads as inherited', () => {
    const old = { ...EMPTY_LAYER } as Record<string, unknown>;
    delete old.whenCompleted;
    delete old.whenAbandoned;
    const d = toDraft(old as unknown as SettingsLayer);
    expect(d.whenCompleted).toEqual({ kind: 'inherit' });
    expect(d.whenAbandoned).toEqual({ kind: 'inherit' });
    expect(fromDraft(d).whenAbandoned).toBeNull();
  });

  it('a chosen after-chatbot value round-trips to the layer', () => {
    const own: SettingsLayer = { ...EMPTY_LAYER, whenAbandoned: 'CLOSE' };
    expect(toDraft(own).whenAbandoned).toEqual({ kind: 'set', text: 'CLOSE' });
    expect(fromDraft(toDraft(own))).toEqual(own);
  });
});
