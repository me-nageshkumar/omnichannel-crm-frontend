import * as React from 'react';
import { importCompanies } from '@app/api/crm';
import { useSession } from '@app/session/SessionContext';
import { ImportModal } from '@app/Crm/csv/ImportModal';

/** Imports companies from CSV: matched by name, then domain; blank cells never overwrite. */
export const CompanyImportModal: React.FunctionComponent<{ onClose(imported: boolean): void }> = ({ onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  return (
    <ImportModal
      title="Import companies"
      required="Name"
      maxRows={2000}
      ready
      run={(file) => importCompanies(token as string, ws, file)}
      onClose={onClose}
    />
  );
};
