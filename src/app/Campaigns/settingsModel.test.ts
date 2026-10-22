import { describe, expect, it } from 'vitest';
import { campaignSettings } from '../../test/campaigns';
import { looserFields, timezoneOptions } from './settingsModel';

describe('settingsModel', () => {
  it('recommendedValuesAreNotLooser', () => {
    expect(looserFields(campaignSettings()).size).toBe(0);
  });

  it('flagsEachLooserPacingValue', () => {
    const s = campaignSettings({ gapMinSeconds: 30, hourlyCap: 13, matureCap: 80, restDays: 5 });
    expect(Array.from(looserFields(s)).sort()).toEqual(['gapMinSeconds', 'hourlyCap', 'matureCap', 'restDays']);
  });

  it('flagsAWarmUpRowAboveTheRecommendedCap', () => {
    expect(Array.from(looserFields(campaignSettings({ warmupCaps: [{ fromDay: 3, cap: 10 }] })))).toEqual([
      'warmupCaps.0',
    ]);
    expect(looserFields(campaignSettings({ warmupCaps: [{ fromDay: 4, cap: 10 }] })).size).toBe(0);
  });

  it('flagsARemovedStopWord', () => {
    const without = ['stop', 'unsubscribe', 'remove me', 'do not message', "don't message"];
    expect(Array.from(looserFields(campaignSettings({ stopWords: without })))).toEqual(['stopWords']);
    const more = ['STOP', ' Unsubscribe ', 'remove me', 'do not message', "don't message", 'No', 'quit'];
    expect(looserFields(campaignSettings({ stopWords: more })).size).toBe(0);
  });

  it('keepsACurrentTimezoneTheBrowserLacks', () => {
    expect(timezoneOptions('Asia/Kolkata')[0]).toBe('Asia/Kolkata');
    expect(timezoneOptions('Europe/London').filter((z) => z === 'Europe/London')).toHaveLength(1);
  });
});
