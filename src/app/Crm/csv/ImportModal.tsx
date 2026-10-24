import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { CrmImportResult } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { useAction } from '@app/admin/useAction';
import { crmMessage } from '@app/Crm/errors';
import { csvRowCount, previewCsv, readText } from '@app/Crm/csv/csvPreview';

/** The words for a refused import. */
function importMessage(e: unknown): string {
  if (e instanceof ApiError && e.code === 'IMPORT_BAD_HEADER') {
    return `The file needs these columns: ${e.extra?.missing ?? ''}`.trim();
  }
  if (e instanceof ApiError && e.code === 'IMPORT_TOO_LARGE') return `Up to ${e.extra?.limit ?? ''} rows per file.`;
  return crmMessage(e, 'Could not import the file. Try again.');
}

/**
 * Picks a CSV, previews its first rows, checks the required column and the row limit, and imports it with
 * {@code run}; then shows what happened, row errors included. {@code children} are extra choices (pipeline, number).
 */
export const ImportModal: React.FunctionComponent<{
  title: string;
  required: string;
  maxRows: number;
  ready: boolean;
  run(file: File): Promise<CrmImportResult>;
  onClose(imported: boolean): void;
  children?: React.ReactNode;
}> = ({ title, required, maxRows, ready, run, onClose, children }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{ headers: string[]; rows: string[][]; count: number } | null>(null);
  const [result, setResult] = React.useState<CrmImportResult | null>(null);
  const action = useAction();
  const input = React.useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    setResult(null);
    action.reset();
    setFile(f ?? null);
    if (!f) return setPreview(null);
    const text = await readText(f);
    setPreview({ ...previewCsv(text), count: csvRowCount(text) });
  };

  const hasHeader = !!preview && preview.headers.some((h) => h.toLowerCase() === required.toLowerCase());
  const tooMany = !!preview && preview.count > maxRows;

  const go = async () => {
    if (!file) return;
    const r = await action.run(() => run(file), importMessage);
    if (r) setResult(r);
  };

  return (
    <Modal isOpen variant="large" onClose={() => onClose(!!result)} aria-labelledby="crm-import-title">
      <ModalHeader title={title} labelId="crm-import-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} className="pf-v6-u-mb-md" />}
        {result ? (
          <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--md)' }}>
            <Alert
              variant={result.errors.length ? 'warning' : 'success'}
              isInline
              title={`Imported ${result.total} ${result.total === 1 ? 'row' : 'rows'}`}
            >
              <span>{`${result.created} created`}</span> · <span>{`${result.updated} updated`}</span> ·{' '}
              <span>{`${result.skipped} skipped`}</span>
            </Alert>
            {result.errors.length > 0 && (
              <Table aria-label="Rows not imported" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Row</Th>
                    <Th>Problem</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {result.errors.map((e) => (
                    <Tr key={`${e.row}-${e.message}`}>
                      <Td dataLabel="Row">{e.row}</Td>
                      <Td dataLabel="Problem">{e.message}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>
        ) : (
          <Form onSubmit={(e) => e.preventDefault()}>
            <FormGroup label="File" fieldId="crm-import-file" isRequired>
              <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', alignItems: 'center' }}>
                <input
                  ref={input}
                  id="crm-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="CSV file"
                  style={{ display: 'none' }}
                  onChange={(e) => void pick(e.target.files?.[0])}
                />
                <Button variant="secondary" onClick={() => input.current?.click()}>
                  Choose file
                </Button>
                <TextInput
                  aria-label="Chosen file"
                  value={file?.name ?? ''}
                  readOnlyVariant="plain"
                  placeholder="No file"
                />
              </div>
            </FormGroup>
            {children}
            {preview && !hasHeader && (
              <Alert variant="warning" isInline isPlain title={`The file needs a "${required}" column.`} />
            )}
            {tooMany && <Alert variant="warning" isInline isPlain title={`Up to ${maxRows} rows per file.`} />}
            {preview && preview.headers.length > 0 && (
              <Table aria-label="Preview" variant="compact">
                <Thead>
                  <Tr>
                    {preview.headers.map((h, i) => (
                      <Th key={`${h}-${i}`}>{h}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {preview.rows.map((r, i) => (
                    <Tr key={i}>
                      {preview.headers.map((h, j) => (
                        <Td key={`${h}-${j}`} dataLabel={h}>
                          {r[j] ?? ''}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        {!result && (
          <Button
            variant="primary"
            isDisabled={!file || !ready || tooMany || action.busy}
            isLoading={action.busy}
            onClick={() => void go()}
          >
            Import
          </Button>
        )}
        <Button variant="link" onClick={() => onClose(!!result)}>
          {result ? 'Close' : 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
