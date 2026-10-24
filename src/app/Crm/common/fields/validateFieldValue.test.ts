import { describe, expect, it } from 'vitest';
import { validateFieldValue } from '@app/Crm/common/fields/validateFieldValue';
import type { FieldDef, FieldType } from '@app/Crm/common/fields/types';

const def = (type: FieldType, extra: Partial<FieldDef> = {}): FieldDef => ({
  key: 'f',
  label: 'F',
  type,
  options: [
    { key: 'gold', label: 'Gold', color: null, position: 1, active: true },
    { key: 'old', label: 'Old', color: null, position: 2, active: false },
  ],
  required: false,
  active: true,
  showInList: false,
  showInCard: false,
  position: 1,
  ...extra,
});

describe('validateFieldValue', () => {
  it.each<[FieldType, unknown, unknown]>([
    ['TEXT', 'hello', 'x'.repeat(1001)],
    ['LONG_TEXT', 'a\nb', 'x'.repeat(10001)],
    ['NUMBER', -3.5, 'abc'],
    ['CURRENCY', 1200, -1],
    ['BOOLEAN', true, 'yes'],
    ['DATE', '2026-10-24', '24/10/2026'],
    ['DATETIME', '2026-10-24T10:00:00Z', 'tomorrow'],
    ['SELECT', 'gold', 'platinum'],
    ['MULTI_SELECT', ['gold'], ['gold', 'gold']],
    ['URL', 'https://example.com', 'example.com'],
    ['EMAIL', 'a@example.com', 'a@b'],
    ['PHONE', '+91 99000-00101', '12345'],
    ['USER', 'u1', 42],
  ])('%s accepts a good value and rejects a bad one', (type, good, bad) => {
    expect(validateFieldValue(def(type), good)).toBeNull();
    expect(validateFieldValue(def(type), bad)).toEqual(expect.any(String));
  });

  it('usesTheServerWording', () => {
    expect(validateFieldValue(def('URL'), 'ftp://x')).toBe('Must be a web address starting with http:// or https://');
    expect(validateFieldValue(def('PHONE'), '12')).toBe('Must be 6 to 15 digits, optionally starting with +');
    expect(validateFieldValue(def('CURRENCY'), -2)).toBe('Must not be negative');
  });

  it('blankIsFineUnlessRequired', () => {
    expect(validateFieldValue(def('TEXT'), '')).toBeNull();
    expect(validateFieldValue(def('MULTI_SELECT'), [])).toBeNull();
    expect(validateFieldValue(def('TEXT', { required: true }), ' ')).toBe('This field is required.');
  });

  it('inactiveOptionOnlyWhenAlreadyStored', () => {
    expect(validateFieldValue(def('SELECT'), 'old')).toBe('Is no longer an option');
    expect(validateFieldValue(def('SELECT'), 'old', 'old')).toBeNull();
  });
});
