import * as React from 'react';
import { Alert, Card, CardBody, CardTitle, Spinner, Tab, TabTitleText, Tabs } from '@patternfly/react-core';
import {
  getBillingSettings,
  getWalletUsage,
  listCustomerCreditNotes,
  listCustomerInvoices,
  listCustomerOrders,
  listCustomerRefunds,
  listWalletEntries,
} from '@app/api/billing';
import { type Loaded, useLoad } from '@app/admin/useLoad';
import { DocumentsTable } from '@app/Billing/common/DocumentsTable';
import { OrdersTable } from '@app/Billing/common/OrdersTable';
import { RefundsTable } from '@app/Billing/common/RefundsTable';
import { UsageTable } from '@app/Billing/common/UsageTable';
import { WalletEntriesTable } from '@app/Billing/common/WalletEntriesTable';
import { OrderDetailModal } from '@app/Billing/platform/OrderDetailModal';

/** A list that is loading, failed, or there. */
function Listed<T>({
  loaded,
  label,
  children,
}: {
  loaded: Loaded<T>;
  label: string;
  children(data: T): React.ReactNode;
}) {
  if (loaded.error) return <Alert variant="danger" isInline title={loaded.error} />;
  if (!loaded.data) return <Spinner aria-label={`Loading ${label}`} />;
  return <>{children(loaded.data)}</>;
}

const OrdersTab: React.FunctionComponent<{
  customerId: string;
  zone: string;
  reloadKey: number;
  onChanged(): void;
}> = ({ customerId, zone, reloadKey, onChanged }) => {
  const orders = useLoad((t) => listCustomerOrders(t, customerId), [customerId, reloadKey], { keepOnError: true });
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <>
      <Listed loaded={orders} label="orders">
        {(list) => <OrdersTable orders={list} onOpen={(o) => setOpenId(o.id)} />}
      </Listed>
      {openId && (
        <OrderDetailModal orderId={openId} zone={zone} onChanged={onChanged} onClose={() => setOpenId(null)} />
      )}
    </>
  );
};

const InvoicesTab: React.FunctionComponent<{ customerId: string; zone: string; reloadKey: number }> = (p) => {
  const invoices = useLoad((t) => listCustomerInvoices(t, p.customerId), [p.customerId, p.reloadKey]);
  return (
    <Listed loaded={invoices} label="invoices">
      {(list) => (
        <DocumentsTable kind="invoice" documents={list} zone={p.zone} linkTo={(id) => `/platform/invoices/${id}`} />
      )}
    </Listed>
  );
};

const CreditNotesTab: React.FunctionComponent<{ customerId: string; zone: string; reloadKey: number }> = (p) => {
  const notes = useLoad((t) => listCustomerCreditNotes(t, p.customerId), [p.customerId, p.reloadKey]);
  return (
    <Listed loaded={notes} label="credit notes">
      {(list) => (
        <DocumentsTable
          kind="creditNote"
          documents={list}
          zone={p.zone}
          linkTo={(id) => `/platform/credit-notes/${id}`}
        />
      )}
    </Listed>
  );
};

const RefundsTab: React.FunctionComponent<{ customerId: string; reloadKey: number }> = (p) => {
  const refunds = useLoad((t) => listCustomerRefunds(t, p.customerId), [p.customerId, p.reloadKey]);
  return (
    <Listed loaded={refunds} label="refunds">
      {(list) => <RefundsTable refunds={list} />}
    </Listed>
  );
};

/**
 * A customer's orders, invoices, credit notes, refunds, wallet ledger and usage, on its page for platform staff. `reloadKey` changes
 * when something on the page changed the customer's billing; `onChanged` says this card did.
 */
export const CustomerBillingTabs: React.FunctionComponent<{
  customerId: string;
  reloadKey: number;
  onChanged(): void;
}> = ({ customerId, reloadKey, onChanged }) => {
  const [tab, setTab] = React.useState('orders');
  const settings = useLoad(getBillingSettings);
  const zone = settings.data?.zone ?? 'Asia/Kolkata';
  return (
    <Card component="section" aria-label="Orders and documents">
      <CardTitle>Orders and documents</CardTitle>
      <CardBody>
        <Tabs
          activeKey={tab}
          onSelect={(_e, key) => setTab(String(key))}
          aria-label="Orders and documents"
          mountOnEnter
          unmountOnExit
        >
          <Tab eventKey="orders" title={<TabTitleText>Orders</TabTitleText>} aria-label="Orders">
            <OrdersTab customerId={customerId} zone={zone} reloadKey={reloadKey} onChanged={onChanged} />
          </Tab>
          <Tab eventKey="invoices" title={<TabTitleText>Invoices</TabTitleText>} aria-label="Invoices">
            <InvoicesTab customerId={customerId} zone={zone} reloadKey={reloadKey} />
          </Tab>
          <Tab eventKey="creditNotes" title={<TabTitleText>Credit notes</TabTitleText>} aria-label="Credit notes">
            <CreditNotesTab customerId={customerId} zone={zone} reloadKey={reloadKey} />
          </Tab>
          <Tab eventKey="refunds" title={<TabTitleText>Refunds</TabTitleText>} aria-label="Refunds">
            <RefundsTab customerId={customerId} reloadKey={reloadKey} />
          </Tab>
          <Tab eventKey="wallet" title={<TabTitleText>Wallet</TabTitleText>} aria-label="Wallet">
            <WalletEntriesTable
              load={(t, page) => listWalletEntries(t, customerId, page)}
              zone={zone}
              reloadKey={reloadKey}
            />
          </Tab>
          <Tab eventKey="usage" title={<TabTitleText>Usage</TabTitleText>} aria-label="Usage">
            <UsageTable load={(t, days) => getWalletUsage(t, customerId, days)} />
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
};
