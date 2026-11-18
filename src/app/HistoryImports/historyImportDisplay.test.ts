import { describe, expect, it } from 'vitest';
import type { HistoryChatView } from '@app/api/historyImports';
import { chatNote } from '@app/HistoryImports/historyImportDisplay';

const chat = (over: Partial<HistoryChatView>) =>
  ({ error: null, olderUnavailable: false, capped: false, ...over }) as HistoryChatView;

describe('chatNote', () => {
  it('namesWhyAChatWasSkipped', () => {
    expect(chatNote(chat({ skipReason: 'NO_CHAT' }))).toBe('No chat on the phone');
    expect(chatNote(chat({ skipReason: 'NOTHING_AFTER_MOVE' }))).toBe('Nothing since the number moved to this brand');
  });
});
