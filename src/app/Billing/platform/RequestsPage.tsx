import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Pagination,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { getBillingSettings, listOrders } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { billingDate } from '@app/Billing/common/billingDate';
import { KIND_LABEL } from '@app/Billing/common/orderText';
import { OrderDetailModal } from '@app/Billing/platform/OrderDetailModal';
import { OrderStatusLabel } from '@app/Billing/platform/OrderStatusLabel';

const PER_PAGE = 50;

/** Platform staff: the orders of every customer, the ones waiting for payment first. */
export const RequestsPage: React.FunctionComponent = () => {
  const [all, setAll] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const orders = useLoad((t) => listOrders(t, { status: all ? undefined : 'REQUESTED', page }), [all, page], {
    keepOnError: true,
  });
  const settings = useLoad(getBillingSettings);
  const zone = settings.data?.zone ?? 'Asia/Kolkata';
  const items = orders.data?.items ?? [];

  return (
    <PageShell title="Billing requests">
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <ToggleGroup aria-label="Which requests">
              <ToggleGroupItem
                text="Open"
                buttonId="requests-open"
                isSelected={!all}
                onChange={() => {
                  setAll(false);
                  setPage(0);
                }}
              />
              <ToggleGroupItem
                text="All"
                buttonId="requests-all"
                isSelected={all}
                onChange={() => {
                  setAll(true);
                  setPage(0);
                }}
              />
            </ToggleGroup>
          </ToolbarItem>
          {orders.data && orders.data.total > PER_PAGE && (
            <ToolbarItem variant="pagination">
              <Pagination
                itemCount={orders.data.total}
                perPage={PER_PAGE}
                page={page + 1}
                perPageOptions={[]}
                onSetPage={(_e, p) => setPage(p - 1)}
                isCompact
              />
            </ToolbarItem>
          )}
        </ToolbarContent>
      </Toolbar>
      {orders.error && <Alert variant="danger" isInline title={orders.error} />}
      {!orders.data && !orders.error && <Spinner aria-label="Loading requests" />}
      {orders.data && items.length === 0 && <p>{all ? 'No orders yet.' : 'Nothing is waiting for payment.'}</p>}
      {items.length > 0 && (
        <Table aria-label="Billing requests" variant="compact">
          <Thead>
            <Tr>
              <Th>Number</Th>
              <Th>Customer</Th>
              <Th>Kind</Th>
              <Th>Amount payable</Th>
              <Th>Raised</Th>
              <Th>Valid until</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((o) => (
              <Tr key={o.id}>
                <Td dataLabel="Number">
                  <Button variant="link" isInline onClick={() => setOpenId(o.id)}>
                    {o.number}
                  </Button>
                </Td>
                <Td dataLabel="Customer">
                  <Link to={`/customers/${o.customerId}`}>{o.customerName}</Link>
                </Td>
                <Td dataLabel="Kind">{KIND_LABEL[o.kind]}</Td>
                <Td dataLabel="Amount payable">{formatMoney(o.payable, 'INR')}</Td>
                <Td dataLabel="Raised">
                  {o.raisedByName}, {new Date(o.raisedAt).toLocaleString()}
                </Td>
                <Td dataLabel="Valid until">
                  {o.status === 'REQUESTED' && o.validUntil ? billingDate(o.validUntil, zone) : ''}
                </Td>
                <Td dataLabel="Status">
                  <OrderStatusLabel status={o.status} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {openId && (
        <OrderDetailModal orderId={openId} zone={zone} onChanged={orders.reload} onClose={() => setOpenId(null)} />
      )}
    </PageShell>
  );
};
