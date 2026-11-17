import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Spinner, Stack, StackItem } from '@patternfly/react-core';
import {
  creditNotePdfPath,
  getBillingSettings,
  getCreditNote,
  getInvoice,
  invoicePdfPath,
  pdfFileName,
} from '@app/api/billing';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { DocumentView } from '@app/Billing/common/DocumentView';
import { PdfButton } from '@app/Billing/common/PdfButton';

/** Platform staff: one invoice, with its PDF. */
export const InvoicePage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const invoice = useLoad((t) => getInvoice(t, id), [id]);
  const settings = useLoad(getBillingSettings);
  const d = invoice.data;
  return (
    <PageShell
      title={d ? `Invoice ${d.number}` : 'Invoice'}
      actions={d ? <PdfButton path={invoicePdfPath(d.id, false)} filename={pdfFileName(d.number)} /> : undefined}
    >
      <Stack hasGutter>
        {invoice.error && <Alert variant="danger" isInline title={invoice.error} />}
        {!d && !invoice.error && <Spinner aria-label="Loading invoice" />}
        {d && (
          <StackItem>
            <DocumentView kind="invoice" document={d} zone={settings.data?.zone ?? 'Asia/Kolkata'} />
          </StackItem>
        )}
      </Stack>
    </PageShell>
  );
};

/** Platform staff: one credit note, with its PDF. */
export const CreditNotePage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const note = useLoad((t) => getCreditNote(t, id), [id]);
  const settings = useLoad(getBillingSettings);
  const d = note.data;
  return (
    <PageShell
      title={d ? `Credit note ${d.number}` : 'Credit note'}
      actions={d ? <PdfButton path={creditNotePdfPath(d.id, false)} filename={pdfFileName(d.number)} /> : undefined}
    >
      <Stack hasGutter>
        {note.error && <Alert variant="danger" isInline title={note.error} />}
        {!d && !note.error && <Spinner aria-label="Loading credit note" />}
        {d && (
          <StackItem>
            <DocumentView
              kind="creditNote"
              document={d}
              zone={settings.data?.zone ?? 'Asia/Kolkata'}
              invoiceLink={(invoiceId) => `/platform/invoices/${invoiceId}`}
            />
          </StackItem>
        )}
      </Stack>
    </PageShell>
  );
};
