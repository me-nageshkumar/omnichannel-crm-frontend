import * as React from 'react';
import { FieldValue } from './FieldValue';
import type { FieldDef, FieldUser } from './types';

export interface FieldColumn {
  key: string;
  title: string;
  render(record: { customFields?: Record<string, unknown> | null }): React.ReactNode;
}

/** Table columns for the active fields shown in lists, in their order. */
export function fieldColumns(defs: FieldDef[], users?: FieldUser[]): FieldColumn[] {
  return defs
    .filter((d) => d.showInList && d.active)
    .sort((a, b) => a.position - b.position)
    .map((d) => ({
      key: d.key,
      title: d.label,
      render: (record) => <FieldValue def={d} value={record.customFields?.[d.key]} users={users} />,
    }));
}
