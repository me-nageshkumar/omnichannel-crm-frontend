import { describe, expect, it } from 'vitest';
import { csvRowCount, previewCsv } from '@app/Crm/csv/csvPreview';

describe('previewCsv', () => {
  it('previewHandlesBomAndCrlf', () => {
    const p = previewCsv('﻿ WhatsApp number ,First name\r\n919900000001,Asha\r\n919900000002,Ravi\r\n\r\n');
    expect(p.headers).toEqual(['WhatsApp number', 'First name']);
    expect(p.rows).toEqual([
      ['919900000001', 'Asha'],
      ['919900000002', 'Ravi'],
    ]);
  });

  it('quotedCommaStaysInCell', () => {
    const p = previewCsv('Name,Note\n"Acme, Inc","said ""hi""\nthen left"\n');
    expect(p.rows).toEqual([['Acme, Inc', 'said "hi"\nthen left']]);
  });

  it('limitsRowsAndCountsAll', () => {
    const text = `Name\n${Array.from({ length: 12 }, (_, i) => `Co ${i}`).join('\n')}\n`;
    expect(previewCsv(text).rows).toHaveLength(5);
    expect(previewCsv(text, 2).rows).toHaveLength(2);
    expect(csvRowCount(text)).toBe(12);
  });
});
