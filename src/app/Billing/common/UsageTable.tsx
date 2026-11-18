import * as React from 'react';
import { Alert, Spinner, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { UsageDay } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { billingDate } from '@app/Billing/common/billingDate';
import { inr4 } from '@app/Billing/common/money';
import { SOURCE_LABEL } from '@app/Billing/common/walletText';

const SPANS = [7, 30, 90];

/** Charged messages by day and by what sent them. The days are days of the billing zone, as the server counted. */
export const UsageTable: React.FunctionComponent<{
  load(token: string, days: number): Promise<UsageDay[]>;
}> = ({ load }) => {
  const [days, setDays] = React.useState(30);
  const usage = useLoad((t) => load(t, days), [days]);
  return (
    <>
      <ToggleGroup aria-label="Days shown" className="pf-v6-u-mb-md">
        {SPANS.map((n) => (
          <ToggleGroupItem key={n} text={`${n} days`} isSelected={days === n} onChange={() => setDays(n)} />
        ))}
      </ToggleGroup>
      {usage.error && <Alert variant="danger" isInline title={usage.error} />}
      {!usage.data && !usage.error && <Spinner aria-label="Loading usage" />}
      {usage.data && usage.data.length === 0 && <p>No charged messages in these days.</p>}
      {usage.data && usage.data.length > 0 && (
        <Table aria-label="Usage" variant="compact">
          <Thead>
            <Tr>
              <Th>Day</Th>
              <Th>Source</Th>
              <Th>Messages</Th>
              <Th>Amount</Th>
            </Tr>
          </Thead>
          <Tbody>
            {usage.data.map((u) => (
              <Tr key={`${u.day}:${u.source}`}>
                {/* a local date already: shown as it is, not moved into a zone again */}
                <Td dataLabel="Day">{billingDate(u.day, 'UTC')}</Td>
                <Td dataLabel="Source">{SOURCE_LABEL[u.source] ?? u.source}</Td>
                <Td dataLabel="Messages">{u.messages}</Td>
                <Td dataLabel="Amount">{inr4(u.amount)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
};
