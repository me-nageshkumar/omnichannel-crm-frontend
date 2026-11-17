import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Spinner } from '@patternfly/react-core';
import {
  creditNotePdfPath,
  getMyCreditNote,
  getMyInvoice,
  getMySubscription,
  invoicePdfPath,
  pdfFileName,
} from '@app/api/billing';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { DocumentView } from '@app/Billing/common/DocumentView';
import { PdfButton } from '@app/Billing/common/PdfButton';

/** One of the customer's own invoices, with its PDF. */
export const MyInvoicePage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const invoice = useLoad((t) => getMyInvoice(t, id), [id]);
  const subscription = useLoad(getMySubscription);
  const d = invoice.data;
  return (
    <PageShell
      title={d ? `Invoice ${d.number}` : 'Invoice'}
      actions={d ? <PdfButton path={invoicePdfPath(d.id, true)} filename={pdfFileName(d.number)} /> : undefined}
    >
      {invoice.error && <Alert variant="danger" isInline title={invoice.error} />}
      {!d && !invoice.error && <Spinner aria-label="Loading invoice" />}
      {d && <DocumentView kind="invoice" document={d} zone={subscription.data?.zone ?? 'Asia/Kolkata'} />}
    </PageShell>
  );
};

/** One of the customer's own credit notes, with its PDF. */
export const MyCreditNotePage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const note = useLoad((t) => getMyCreditNote(t, id), [id]);
  const subscription = useLoad(getMySubscription);
  const d = note.data;
  return (
    <PageShell
      title={d ? `Credit note ${d.number}` : 'Credit note'}
      actions={d ? <PdfButton path={creditNotePdfPath(d.id, true)} filename={pdfFileName(d.number)} /> : undefined}
    >
      {note.error && <Alert variant="danger" isInline title={note.error} />}
      {!d && !note.error && <Spinner aria-label="Loading credit note" />}
      {d && (
        <DocumentView
          kind="creditNote"
          document={d}
          zone={subscription.data?.zone ?? 'Asia/Kolkata'}
          invoiceLink={(invoiceId) => `/billing/invoices/${invoiceId}`}
        />
      )}
    </PageShell>
  );
};
