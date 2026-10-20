import * as React from 'react';
import {
  Alert,
  Button,
  FileUpload,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';
import type { ImportResult } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';

export const IMPORT_HINT =
  'CSV with a header row. phone is required (country code first); name, labels (separated by ;) and columns named after your attributes are optional.';

/** Upload a CSV, run the import, show what happened. */
export const ImportContactsModal: React.FunctionComponent<{
  upload(file: File): Promise<ImportResult>;
  onImported(): void;
  onClose(): void;
}> = ({ upload, onImported, onClose }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const action = useAction();

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!file) return;
    const done = await action.run(() => upload(file));
    if (done) {
      setResult(done);
      onImported();
    }
  };

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="import-title">
      <ModalHeader title="Import contacts" labelId="import-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        {result ? (
          <>
            <ul aria-label="Import summary">
              <li>{`${result.created} created`}</li>
              <li>{`${result.updated} updated`}</li>
              <li>{`${result.unchanged} unchanged`}</li>
              <li>{`${result.skipped} skipped`}</li>
            </ul>
            {result.unknownColumns.length > 0 && <p>{`Ignored columns: ${result.unknownColumns.join(', ')}`}</p>}
            {result.unknownLabels.length > 0 && <p>{`Ignored labels: ${result.unknownLabels.join(', ')}`}</p>}
            {result.problems.length > 0 && (
              <ul aria-label="Problems">
                {result.problems.map((p) => (
                  <li key={p.row}>{`Row ${p.row}: ${p.reason}`}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <Form id="import-form" onSubmit={onSubmit}>
            <FormGroup label="CSV file" fieldId="import-file">
              <FileUpload
                id="import-file"
                filename={file?.name ?? ''}
                browseButtonText="Choose file"
                hideDefaultPreview
                onFileInputChange={(_e, f) => setFile(f)}
                onClearClick={() => setFile(null)}
                dropzoneProps={{ accept: { 'text/csv': ['.csv'] } }}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{IMPORT_HINT}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        {result ? (
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button type="submit" form="import-form" isDisabled={!file || action.busy} isLoading={action.busy}>
              Import
            </Button>
            <Button variant="link" onClick={onClose}>
              Cancel
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};
