import * as React from 'react';
import {
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
  LabelGroup,
} from '@patternfly/react-core';
import type { Subscription } from '@app/api/billing';

const SOURCES: { source: Subscription['groups'][number]['source']; title: string }[] = [
  { source: 'PLAN', title: 'In this plan' },
  { source: 'ADDON', title: 'Add-ons' },
  { source: 'DEFAULT', title: 'In every plan' },
];

/** What a customer holds, by where it comes from. For use inside a DescriptionList. */
export const IncludedGroups: React.FunctionComponent<{ groups: Subscription['groups'] }> = ({ groups }) => (
  <>
    {SOURCES.map(({ source, title }) => {
      const held = groups.filter((g) => g.source === source);
      if (held.length === 0) return null;
      return (
        <DescriptionListGroup key={source}>
          <DescriptionListTerm>{title}</DescriptionListTerm>
          <DescriptionListDescription>
            <LabelGroup numLabels={20}>
              {held.map((g) => (
                <Label key={g.code} isCompact color={source === 'DEFAULT' ? 'grey' : 'blue'}>
                  {g.name}
                </Label>
              ))}
            </LabelGroup>
          </DescriptionListDescription>
        </DescriptionListGroup>
      );
    })}
  </>
);
