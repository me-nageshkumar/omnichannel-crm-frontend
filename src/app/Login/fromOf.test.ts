import { describe, expect, it } from 'vitest';
import { fromOf } from '@app/Login/LoginFrame';

describe('fromOf', () => {
  it('keeps an in-app path', () => {
    expect(fromOf({ from: '/profile' })).toBe('/profile');
  });

  it.each(['//evil.example', '//2130706433/', '/\\evil.example', 'https://evil.example', '/login/verify', 42])(
    'falls back to the dashboard for %s',
    (from) => {
      expect(fromOf({ from })).toBe('/');
    },
  );
});
