import * as React from 'react';
import { Alert, Button, Label, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { CloudTemplate, listCloudTemplates, syncCloudTemplates } from '@app/api/cloudTemplates';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { CloudTemplatePreview } from '@app/CloudTemplates/CloudTemplatePreview';
import { FillsModal } from '@app/CloudTemplates/FillsModal';

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'red' | 'grey'> = {
  APPROVED: 'green',
  PENDING: 'blue',
  IN_APPEAL: 'blue',
  PAUSED: 'orange',
  REJECTED: 'red',
  DISABLED: 'red',
  DELETED: 'grey',
};

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/**
 * The brand's WhatsApp templates: Meta's, written and approved in WhatsApp Manager, imported here (spec 2026-11-20
 * §5.6). Not the "Templates" page, which holds WhatsApp Web saved messages.
 */
export const CloudTemplatesPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const access = useAccess();
  const canManage = access.hasInWorkspace('phone-number:manage');
  const templates = useLoad((t) => listCloudTemplates(t, ws), [ws]);
  const sync = useAction();
  const [synced, setSynced] = React.useState<string | null>(null);
  const [filling, setFilling] = React.useState<CloudTemplate | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);

  const onSync = async () => {
    setSynced(null);
    const r = await sync.run(() => syncCloudTemplates(token as string, ws));
    if (r) {
      setSynced(`${r.added} added, ${r.updated} updated, ${r.removed} removed`);
      templates.reload();
    }
  };

  return (
    <PageShell
      title="WhatsApp templates"
      actions={
        canManage && (
          <Button variant="primary" onClick={onSync} isDisabled={sync.busy} isLoading={sync.busy}>
            Sync from Meta
          </Button>
        )
      }
    >
      <p className="pf-v6-u-mb-md">
        Templates are written and approved in Meta&apos;s WhatsApp Manager. Only approved ones can be sent; they are
        what a Cloud API number may send after the customer&apos;s 24-hour window.
      </p>
      {synced && <Alert variant="success" isInline isPlain title={`Synced: ${synced}`} />}
      {sync.error && <Alert variant="danger" isInline title={sync.error} />}
      {templates.error && <Alert variant="danger" isInline title={templates.error} />}
      {templates.loading && !templates.data ? (
        <Spinner aria-label="Loading WhatsApp templates" />
      ) : (templates.data ?? []).length === 0 ? (
        <p>No WhatsApp templates yet. Add a Meta connection on Phone numbers, then sync.</p>
      ) : (
        <Table aria-label="WhatsApp templates" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Language</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Blanks</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(templates.data ?? []).map((t) => (
              <React.Fragment key={t.id}>
                <Tr>
                  <Td dataLabel="Name">
                    <Button variant="link" isInline onClick={() => setOpen(open === t.id ? null : t.id)}>
                      {t.name}
                    </Button>
                  </Td>
                  <Td dataLabel="Language">{t.language}</Td>
                  <Td dataLabel="Category">{t.category ? title(t.category) : '—'}</Td>
                  <Td dataLabel="Status">
                    <Label color={STATUS_COLORS[t.status] ?? 'grey'}>{title(t.status)}</Label>
                    {t.rejectedReason && <div className="pf-v6-u-font-size-sm">{t.rejectedReason}</div>}
                    {!t.supported && <div className="pf-v6-u-font-size-sm">{t.unsupportedReason}</div>}
                  </Td>
                  <Td dataLabel="Blanks">
                    {t.variables.length === 0
                      ? 'None'
                      : t.variables.map((v) => `${v.key}${t.fills[v.key] ? ' ✓' : ''}`).join(', ')}
                  </Td>
                  <Td isActionCell>
                    {canManage && t.supported && t.variables.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={() => setFilling(t)}>
                        Fills
                      </Button>
                    )}
                  </Td>
                </Tr>
                {open === t.id && (
                  <Tr>
                    <Td colSpan={6}>
                      <CloudTemplatePreview template={t} />
                    </Td>
                  </Tr>
                )}
              </React.Fragment>
            ))}
          </Tbody>
        </Table>
      )}
      {filling && (
        <FillsModal
          template={filling}
          onSaved={(saved) => {
            templates.setData((list) => upsert(list ?? [], saved));
            setFilling(null);
          }}
          onCancel={() => setFilling(null)}
        />
      )}
    </PageShell>
  );
};
