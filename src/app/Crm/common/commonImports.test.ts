import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('common CRM components', () => {
  it('commonComponentsAreCrmFree', () => {
    const files = readdirSync(__dirname).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      for (const m of Array.from(src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g))) {
        const spec = m[1];
        const crm = spec.startsWith('@app/Crm/') && !spec.startsWith('@app/Crm/common');
        const rel = /^\.\.\/(?!common\b)/.test(spec);
        if (spec.startsWith('@app/api/crm') || crm || rel) bad.push(`${f}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
