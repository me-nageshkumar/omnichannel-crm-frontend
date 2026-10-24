import * as React from 'react';
import { DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from '@patternfly/react-core';
import type { FieldEntityType } from '@app/api/crm';
import { FieldValue } from '@app/Crm/common/fields/FieldValue';
import { useFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';

/** Description-list rows for the record's active custom fields marked "show on card", in their order. */
export const CardFieldDetails: React.FunctionComponent<{
  entity: FieldEntityType;
  values: Record<string, unknown> | null | undefined;
}> = ({ entity, values }) => {
  const { defs } = useFieldDefinitions(entity);
  return (
    <>
      {defs
        .filter((d) => d.active && d.showInCard)
        .map((d) => (
          <DescriptionListGroup key={d.key}>
            <DescriptionListTerm>{d.label}</DescriptionListTerm>
            <DescriptionListDescription>
              <FieldValue def={d} value={values?.[d.key]} />
            </DescriptionListDescription>
          </DescriptionListGroup>
        ))}
    </>
  );
};
