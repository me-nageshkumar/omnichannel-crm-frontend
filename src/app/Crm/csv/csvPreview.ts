/** RFC 4180 rows of a CSV text: a leading BOM is skipped, CRLF or LF end a row, all-blank rows are dropped. */
export function parseCsv(text: string, limit = Infinity): string[][] {
  const rows: string[][] = [];
  let i = text.startsWith('﻿') ? 1 : 0;
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const push = () => {
    row.push(cell);
    cell = '';
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };
  for (; i < text.length && rows.length < limit; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      push();
    } else cell += c;
  }
  if (rows.length < limit && (cell !== '' || row.length > 0)) push();
  return rows;
}

/** The trimmed header and the first {@code rows} data rows, for a preview before importing. */
export function previewCsv(text: string, rows = 5): { headers: string[]; rows: string[][] } {
  const all = parseCsv(text, rows + 1);
  return { headers: (all[0] ?? []).map((h) => h.trim()), rows: all.slice(1, rows + 1) };
}

/** The number of data rows (the header not counted). */
export const csvRowCount = (text: string): number => Math.max(parseCsv(text).length - 1, 0);

/** The text of a picked file. */
export function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
