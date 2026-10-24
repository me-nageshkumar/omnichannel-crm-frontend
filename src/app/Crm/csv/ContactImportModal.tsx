import * as React from 'react';
import { FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { importContacts, listPipelines } from '@app/api/crm';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { ImportModal } from '@app/Crm/csv/ImportModal';

/** Imports contacts from CSV into one pipeline (each gets an open deal there) on one WhatsApp number. */
export const ContactImportModal: React.FunctionComponent<{ onClose(imported: boolean): void }> = ({ onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const pipelines = useLoad((t) => listPipelines(t, ws), [ws]);
  const access = status?.pipelineAccess ?? 'ALL';
  const usable = (pipelines.data ?? []).filter((p) => p.active && (access === 'ALL' || access.includes(p.id)));
  const phones = (status?.phones ?? []).filter((p) => p.canChat);
  const [pipelineId, setPipelineId] = React.useState('');
  const [phoneNumberId, setPhoneNumberId] = React.useState('');

  return (
    <ImportModal
      title="Import contacts"
      required="WhatsApp number"
      maxRows={1000}
      ready={!!pipelineId && !!phoneNumberId}
      run={(file) => importContacts(token as string, ws, file, pipelineId, phoneNumberId)}
      onClose={onClose}
    >
      <FormGroup label="Pipeline" fieldId="crm-import-pipeline">
        <FormSelect id="crm-import-pipeline" value={pipelineId} onChange={(_e, v) => setPipelineId(v)}>
          <FormSelectOption value="" label="Choose a pipeline" isPlaceholder />
          {usable.map((p) => (
            <FormSelectOption key={p.id} value={p.id} label={p.name} />
          ))}
        </FormSelect>
      </FormGroup>
      <FormGroup label="WhatsApp number" fieldId="crm-import-number">
        <FormSelect id="crm-import-number" value={phoneNumberId} onChange={(_e, v) => setPhoneNumberId(v)}>
          <FormSelectOption value="" label="Choose a number" isPlaceholder />
          {phones.map((p) => (
            <FormSelectOption
              key={p.phoneNumberId}
              value={p.phoneNumberId}
              label={p.label ? `${p.label} (${p.number})` : p.number}
            />
          ))}
        </FormSelect>
      </FormGroup>
    </ImportModal>
  );
};
