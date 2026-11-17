import * as React from 'react';
import { Alert, Card, CardBody, CardTitle, Spinner, Tab, TabTitleText, Tabs } from '@patternfly/react-core';
import { listMyCreditNotes, listMyInvoices, listMyRefunds } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { DocumentsTable } from '@app/Billing/common/DocumentsTable';
import { RefundsTable } from '@app/Billing/common/RefundsTable';

const InvoicesTab: React.FunctionComponent<{ zone: string; reloadKey: number }> = ({ zone, reloadKey }) => {
  const invoices = useLoad(listMyInvoices, [reloadKey]);
  if (invoices.error) return <Alert variant="danger" isInline title={invoices.error} />;
  if (!invoices.data) return <Spinner aria-label="Loading invoices" />;
  return (
    <DocumentsTable kind="invoice" documents={invoices.data} zone={zone} linkTo={(id) => `/billing/invoices/${id}`} />
  );
};

const CreditNotesTab: React.FunctionComponent<{ zone: string; reloadKey: number }> = ({ zone, reloadKey }) => {
  const notes = useLoad(listMyCreditNotes, [reloadKey]);
  if (notes.error) return <Alert variant="danger" isInline title={notes.error} />;
  if (!notes.data) return <Spinner aria-label="Loading credit notes" />;
  return (
    <DocumentsTable
      kind="creditNote"
      documents={notes.data}
      zone={zone}
      linkTo={(id) => `/billing/credit-notes/${id}`}
    />
  );
};

const RefundsTab: React.FunctionComponent<{ reloadKey: number }> = ({ reloadKey }) => {
  const refunds = useLoad(listMyRefunds, [reloadKey]);
  if (refunds.error) return <Alert variant="danger" isInline title={refunds.error} />;
  if (!refunds.data) return <Spinner aria-label="Loading refunds" />;
  return <RefundsTable refunds={refunds.data} />;
};

/** The customer's invoices, credit notes and refunds. */
export const MyDocuments: React.FunctionComponent<{ zone: string; reloadKey: number }> = ({ zone, reloadKey }) => {
  const [tab, setTab] = React.useState('invoices');
  return (
    <Card component="section" aria-label="Invoices and credit">
      <CardTitle>Invoices and credit</CardTitle>
      <CardBody>
        <Tabs
          activeKey={tab}
          onSelect={(_e, key) => setTab(String(key))}
          aria-label="Invoices and credit"
          mountOnEnter
          unmountOnExit
        >
          <Tab eventKey="invoices" title={<TabTitleText>Invoices</TabTitleText>} aria-label="Invoices">
            <InvoicesTab zone={zone} reloadKey={reloadKey} />
          </Tab>
          <Tab eventKey="creditNotes" title={<TabTitleText>Credit notes</TabTitleText>} aria-label="Credit notes">
            <CreditNotesTab zone={zone} reloadKey={reloadKey} />
          </Tab>
          <Tab eventKey="refunds" title={<TabTitleText>Refunds</TabTitleText>} aria-label="Refunds">
            <RefundsTab reloadKey={reloadKey} />
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
};
