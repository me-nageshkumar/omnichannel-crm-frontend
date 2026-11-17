import * as React from 'react';
import { Progress, ProgressMeasureLocation, ProgressVariant } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { SubscriptionLimit } from '@app/api/billing';

/** "3 of 5", "7 of unlimited", "up to 30" for a limit that is not counted across the customer. */
export function usageText(l: SubscriptionLimit): string {
  const limit = l.limit === null ? 'unlimited' : String(l.limit);
  return l.used === null ? (l.limit === null ? 'Unlimited' : `Up to ${limit}`) : `${l.used} of ${limit}`;
}

/** A plan's limits with what the customer uses now. A customer over a lowered limit keeps what it has. */
export const LimitsTable: React.FunctionComponent<{ limits: SubscriptionLimit[] }> = ({ limits }) => (
  <Table aria-label="Limits" variant="compact">
    <Thead>
      <Tr>
        <Th>Limit</Th>
        <Th width={20}>Use</Th>
        <Th width={30} screenReaderText="Share used" />
      </Tr>
    </Thead>
    <Tbody>
      {limits.map((l) => {
        const counted = l.used !== null && l.limit !== null && l.limit > 0;
        const over = counted && (l.used as number) >= (l.limit as number);
        return (
          <Tr key={l.key}>
            <Td dataLabel="Limit">{l.label}</Td>
            <Td dataLabel="Use">{usageText(l)}</Td>
            <Td>
              {counted && (
                <Progress
                  aria-label={`${l.label} used`}
                  value={Math.min(100, Math.round(((l.used as number) / (l.limit as number)) * 100))}
                  measureLocation={ProgressMeasureLocation.none}
                  variant={over ? ProgressVariant.danger : undefined}
                />
              )}
            </Td>
          </Tr>
        );
      })}
    </Tbody>
  </Table>
);
