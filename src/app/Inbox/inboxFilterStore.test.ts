import { afterEach, describe, expect, it } from 'vitest';
import { filterKey, readInboxFilter, writeInboxFilter } from '@app/Inbox/inboxFilterStore';

afterEach(() => localStorage.clear());

describe('inbox filter store', () => {
  it('round-trips the selected numbers per user and brand', () => {
    writeInboxFilter('u1', 'w1', ['p2', 'p1']);
    expect(readInboxFilter('u1', 'w1')).toEqual(['p2', 'p1']);
    expect(readInboxFilter('u1', 'w2')).toEqual([]);
    expect(readInboxFilter('u2', 'w1')).toEqual([]);
    expect(localStorage.getItem(filterKey('u1', 'w1'))).toBe('["p2","p1"]');
  });

  it('an empty selection means every number and is stored as such', () => {
    writeInboxFilter('u1', 'w1', ['p1']);
    writeInboxFilter('u1', 'w1', []);
    expect(readInboxFilter('u1', 'w1')).toEqual([]);
  });

  it('bad or foreign stored values read as every number', () => {
    localStorage.setItem(filterKey('u1', 'w1'), '{not json');
    expect(readInboxFilter('u1', 'w1')).toEqual([]);
    localStorage.setItem(filterKey('u1', 'w1'), '{"a":1}');
    expect(readInboxFilter('u1', 'w1')).toEqual([]);
    localStorage.setItem(filterKey('u1', 'w1'), '[1, "p1"]');
    expect(readInboxFilter('u1', 'w1')).toEqual(['p1']);
  });
});
