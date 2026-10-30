import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The chart components draw any data: they import nothing from the CRM or the API. */
describe('report chart components', () => {
  it('chartsAreCrmFree', () => {
    const files = readdirSync(__dirname).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      for (const m of Array.from(src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g))) {
        const spec = m[1];
        const crm = spec.startsWith('@app/Crm/') && !spec.startsWith('@app/Crm/reports/charts');
        const rel = spec.startsWith('../');
        if (spec.startsWith('@app/api') || crm || rel) bad.push(`${f}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
