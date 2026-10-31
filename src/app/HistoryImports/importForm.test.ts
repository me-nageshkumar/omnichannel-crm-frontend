import { describe, expect, it } from 'vitest';
import { dayEnd, dayStart, parsePhones, validateRange } from './importForm';

describe('importForm', () => {
  it('parsePhonesNormalisesAndDrops', () => {
    expect(parsePhones('+91 99280-88743\n\n9199280 88744, 12345')).toEqual({
      phones: ['919928088743', '919928088744'],
      invalid: ['12345'],
    });
    expect(parsePhones('919928088743\n+91 99280 88743').phones).toEqual(['919928088743']);
  });

  it('validateRangeRejectsFromAfterTo', () => {
    expect(validateRange('2026-02-01', '2026-01-31')).toBe('"From" must not be after "To".');
    expect(validateRange('2026-01-31', '2026-01-31')).toBeNull();
    expect(validateRange('', '2026-01-31')).toBeNull();
    expect(validateRange('2026-02-01', '')).toBeNull();
  });

  it('dayStartAndEndWrapTheDay', () => {
    expect(new Date(dayStart('2026-03-05')).getTime()).toBe(new Date(2026, 2, 5, 0, 0, 0, 0).getTime());
    expect(new Date(dayEnd('2026-03-05')).getTime()).toBe(new Date(2026, 2, 5, 23, 59, 59, 999).getTime());
  });
});
