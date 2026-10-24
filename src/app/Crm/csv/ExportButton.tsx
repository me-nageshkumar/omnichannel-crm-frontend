import * as React from 'react';
import { Alert, Button } from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { exportRecords } from '@app/api/crm';
import type { ExportEntity } from '@app/api/crm';
import { saveFile } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { crmMessage } from '@app/Crm/errors';

/** Downloads the list as CSV with the page's current filters and sort. */
export const ExportButton: React.FunctionComponent<{
  entity: ExportEntity;
  search: Record<string, unknown>;
  disabled?: boolean;
}> = ({ entity, search, disabled }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const action = useAction();
  const run = async () => {
    const file = await action.run(
      () => exportRecords(token as string, ws, entity, search),
      (e) => crmMessage(e, 'Could not export. Try again.'),
    );
    if (file) saveFile(file.blob, file.fileName);
  };
  return (
    <>
      <Button
        variant="secondary"
        icon={<DownloadIcon />}
        isDisabled={disabled || action.busy}
        isLoading={action.busy}
        onClick={() => void run()}
      >
        Export CSV
      </Button>
      {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
    </>
  );
};
