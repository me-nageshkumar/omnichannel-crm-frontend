import * as React from 'react';
import { ExpandableSection } from '@patternfly/react-core';
import type { FieldDefinition } from '@app/api/crm';
import { FieldInput } from '@app/Crm/common/fields/FieldInput';
import { isBlank } from '@app/Crm/common/fields/validateFieldValue';
import type { FieldUser } from '@app/Crm/common/fields/types';

/**
 * The custom fields of a record form, folded under "More fields" (open when a field is required or has an error).
 * A field switched off since shows its stored value read-only, and only when there is one.
 */
export const MoreFieldsSection: React.FunctionComponent<{
  defs: FieldDefinition[];
  values: Record<string, unknown>;
  stored?: Record<string, unknown> | null;
  onChange(next: Record<string, unknown>): void;
  errors: Record<string, string>;
  users?: FieldUser[];
}> = ({ defs, values, stored, onChange, errors, users }) => {
  const shown = defs.filter((d) => d.active || !isBlank(stored?.[d.key])).sort((a, b) => a.position - b.position);
  const mustOpen = shown.some((d) => d.active && d.required) || Object.keys(errors).some((k) => errors[k]);
  const [expanded, setExpanded] = React.useState(mustOpen);
  React.useEffect(() => {
    if (mustOpen) setExpanded(true);
  }, [mustOpen]);
  if (shown.length === 0) return null;
  return (
    <ExpandableSection toggleText="More fields" isExpanded={expanded} onToggle={(_e, open) => setExpanded(open)}>
      <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--md)' }}>
        {shown.map((d) => (
          <FieldInput
            key={d.key}
            def={d.active ? d : { ...d, label: `${d.label} (no longer in use)`, required: false }}
            value={values[d.key] ?? (d.active ? null : stored?.[d.key])}
            onChange={(v) => onChange({ ...values, [d.key]: v })}
            error={errors[d.key]}
            readOnly={!d.active}
            users={users}
          />
        ))}
      </div>
    </ExpandableSection>
  );
};
