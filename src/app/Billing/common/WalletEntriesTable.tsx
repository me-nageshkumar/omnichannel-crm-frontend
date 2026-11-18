import * as React from 'react';
import { Alert, Pagination, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { WalletEntry, WalletEntryPage } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { billingDateTime } from '@app/Billing/common/billingDate';
import { inr4 } from '@app/Billing/common/money';
import { ENTRY_LABEL, SOURCE_LABEL, signed4 } from '@app/Billing/common/walletText';

const PER_PAGE = 50;

/** The order behind a top-up or a refund; what other entries refer to is not for people. */
const orderOf = (e: WalletEntry) => (e.type === 'TOPUP' || e.type === 'REFUND' ? e.ref : null);

/**
 * The wallet's ledger, newest first, a page at a time. `reloadKey` changes when something changed the wallet; the
 * page then asks again without emptying itself.
 */
export const WalletEntriesTable: React.FunctionComponent<{
  load(token: string, page: number): Promise<WalletEntryPage>;
  zone: string;
  reloadKey?: number;
}> = ({ load, zone, reloadKey = 0 }) => {
  // The page asked for is not part of the load's key: a new page is asked for in place, so the rows and the pager
  // stay on screen until the answer comes, and stay if it fails. The pager shows the page the rows are of (the
  // server's answer), so the two cannot disagree.
  const wanted = React.useRef(0);
  const entries = useLoad((t) => load(t, wanted.current), [], { keepOnError: true });
  const reload = entries.reload;
  const go = (to: number) => {
    wanted.current = to;
    reload();
  };
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // something changed the wallet: its line is the newest, on the first page
    wanted.current = 0;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  if (entries.error && !entries.data) return <Alert variant="danger" isInline title={entries.error} />;
  if (!entries.data) return <Spinner aria-label="Loading wallet entries" />;
  const { items, total } = entries.data;
  // a customer is not told which member of staff or which of its people did it
  const named = items.some((e) => !!e.byName);
  return (
    <>
      {entries.error && <Alert variant="danger" isInline title={entries.error} />}
      {items.length === 0 ? (
        <p>Nothing has gone in or out of the wallet yet.</p>
      ) : (
        <Table aria-label="Wallet entries" variant="compact">
          <Thead>
            <Tr>
              <Th>When</Th>
              <Th>What</Th>
              <Th>Source</Th>
              <Th>Brand</Th>
              <Th>Amount</Th>
              <Th>Balance after</Th>
              <Th>Note / reference</Th>
              {named && <Th>By</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {items.map((e) => (
              <Tr key={e.id}>
                <Td dataLabel="When">{billingDateTime(e.at, zone)}</Td>
                <Td dataLabel="What">{ENTRY_LABEL[e.type] ?? e.type}</Td>
                <Td dataLabel="Source">{e.source ? (SOURCE_LABEL[e.source] ?? e.source) : ''}</Td>
                <Td dataLabel="Brand">{e.workspaceName ?? ''}</Td>
                <Td dataLabel="Amount">{signed4(e.amount)}</Td>
                <Td dataLabel="Balance after">{inr4(e.balanceAfter)}</Td>
                <Td dataLabel="Note / reference">
                  {orderOf(e) && <div>{orderOf(e)}</div>}
                  {e.note && <div>{e.note}</div>}
                </Td>
                {named && <Td dataLabel="By">{e.byName ?? ''}</Td>}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {total > PER_PAGE && (
        <Pagination
          itemCount={total}
          perPage={PER_PAGE}
          page={entries.data.page + 1}
          perPageOptions={[]}
          onSetPage={(_e, p) => go(p - 1)}
          isCompact
        />
      )}
    </>
  );
};
