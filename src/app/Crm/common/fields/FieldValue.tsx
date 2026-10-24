import * as React from 'react';
import { isBlank } from './validateFieldValue';
import type { FieldDef, FieldUser } from './types';

const optionLabel = (def: FieldDef, key: unknown) => def.options.find((o) => o.key === key)?.label ?? String(key);

/** A custom field value for reading: option labels, local dates, Yes/No, links that open safely; "—" when unset. */
export const FieldValue: React.FunctionComponent<{ def: FieldDef; value: unknown; users?: FieldUser[] }> = ({
  def,
  value,
  users = [],
}) => {
  if (isBlank(value)) return <>—</>;
  switch (def.type) {
    case 'SELECT':
      return <>{optionLabel(def, value)}</>;
    case 'MULTI_SELECT':
      return <>{(Array.isArray(value) ? value : [value]).map((k) => optionLabel(def, k)).join(', ')}</>;
    case 'BOOLEAN':
      return <>{value === true || value === 'true' ? 'Yes' : 'No'}</>;
    case 'DATE': {
      const d = new Date(`${String(value)}T00:00:00`);
      return <>{Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}</>;
    }
    case 'DATETIME': {
      const d = new Date(String(value));
      return <>{Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()}</>;
    }
    case 'NUMBER':
    case 'CURRENCY':
      return <>{typeof value === 'number' ? value.toLocaleString() : String(value)}</>;
    case 'URL': {
      const href = String(value);
      return /^https?:\/\//i.test(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {href}
        </a>
      ) : (
        <>{href}</>
      );
    }
    case 'USER':
      return <>{users.find((u) => u.id === value)?.name ?? String(value)}</>;
    default:
      return <>{String(value)}</>;
  }
};
