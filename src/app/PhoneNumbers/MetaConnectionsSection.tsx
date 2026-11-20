import * as React from 'react';
import {
  Alert,
  Button,
  ClipboardCopy,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  ExpandableSection,
  Label,
  Spinner,
} from '@patternfly/react-core';
import {
  MetaConnection,
  checkMetaConnection,
  deleteMetaConnection,
  listMetaConnections,
  retryWebhookSetup,
} from '@app/api/metaConnections';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { MetaConnectionModal } from '@app/PhoneNumbers/MetaConnectionModal';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';

const SETUP: Record<MetaConnection['webhook']['setup'], string> = {
  AUTO: 'Set up automatically',
  OVERRIDE: 'Set on each WhatsApp account (the app sends elsewhere)',
  MANUAL: 'Paste these in the Meta app dashboard (WhatsApp → Configuration)',
};

/**
 * The brand's Meta apps (spec 2026-11-20 §5.7): status, token hint, the webhook address and verify token to copy, the
 * last webhook. Loaded when opened; open at once when the brand has a Cloud number.
 */
export const MetaConnectionsSection: React.FunctionComponent<{
  canManage: boolean;
  expandedAtStart: boolean;
  /** Bumped by the page when a connection was added elsewhere (the add-number flow), to reload. */
  reloadKey?: number;
}> = ({ canManage, expandedAtStart, reloadKey }) => {
  const [expanded, setExpanded] = React.useState(expandedAtStart);
  React.useEffect(() => {
    if (expandedAtStart) setExpanded(true);
  }, [expandedAtStart]);
  return (
    <ExpandableSection
      toggleText="Meta connections (WhatsApp Cloud API)"
      isExpanded={expanded}
      onToggle={(_e, v) => setExpanded(v)}
      className="pf-v6-u-mt-lg"
    >
      {expanded && <ConnectionsList canManage={canManage} reloadKey={reloadKey} />}
    </ExpandableSection>
  );
};

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; connection: MetaConnection }
  | { kind: 'delete'; connection: MetaConnection };

const ConnectionsList: React.FunctionComponent<{ canManage: boolean; reloadKey?: number }> = ({
  canManage,
  reloadKey,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const connections = useLoad((tok) => listMetaConnections(tok, ws), [ws, reloadKey]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const act = useAction();
  const put = (c: MetaConnection) => connections.setData((list) => upsert(list ?? [], c));
  const close = () => setDialog(null);

  if (connections.loading && !connections.data) return <Spinner size="md" aria-label="Loading Meta connections" />;
  return (
    <>
      {connections.error && <Alert variant="danger" isInline title={connections.error} />}
      {act.error && <Alert variant="danger" isInline isPlain title={act.error} />}
      {canManage && (
        <Button variant="secondary" onClick={() => setDialog({ kind: 'add' })}>
          Add Meta connection
        </Button>
      )}
      {(connections.data ?? []).length === 0 && <p className="pf-v6-u-mt-md">No Meta connections yet.</p>}
      {(connections.data ?? []).map((c) => (
        <section key={c.id} aria-label={`Meta connection ${c.name}`} className="pf-v6-u-mt-md">
          <h3>
            {c.name}{' '}
            <Label color={c.status === 'OK' ? 'green' : c.status === 'INVALID' ? 'red' : 'grey'}>
              {c.status === 'OK' ? 'Token accepted' : c.status === 'INVALID' ? 'Token invalid' : 'Not checked'}
            </Label>
          </h3>
          {c.lastError && <Alert variant="danger" isInline isPlain title={c.lastError} />}
          <DescriptionList isCompact isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>App ID</DescriptionListTerm>
              <DescriptionListDescription>{c.appId}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Access token</DescriptionListTerm>
              <DescriptionListDescription>
                <code>{c.tokenHint}</code>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Webhook</DescriptionListTerm>
              <DescriptionListDescription>
                {SETUP[c.webhook.setup]}
                {c.webhook.error && <Alert variant="warning" isInline isPlain title={c.webhook.error} />}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Callback URL</DescriptionListTerm>
              <DescriptionListDescription>
                <ClipboardCopy isReadOnly hoverTip="Copy" clickTip="Copied" aria-label="Callback URL">
                  {c.webhook.url}
                </ClipboardCopy>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Verify token</DescriptionListTerm>
              <DescriptionListDescription>
                <ClipboardCopy isReadOnly hoverTip="Copy" clickTip="Copied" aria-label="Verify token">
                  {c.webhook.verifyToken}
                </ClipboardCopy>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Last webhook</DescriptionListTerm>
              <DescriptionListDescription>
                {c.webhook.lastWebhookAt ? relative(c.webhook.lastWebhookAt) : 'None yet'}
                {c.ignoredChanges > 0 &&
                  ` · ${c.ignoredChanges} for numbers not added here (last ${c.lastIgnoredNumber ?? '?'})`}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Numbers</DescriptionListTerm>
              <DescriptionListDescription>
                {c.numbers.length === 0 ? 'None' : c.numbers.map((n) => n.label ?? `+${n.number}`).join(', ')}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
          {canManage && (
            <div className="pf-v6-u-mt-sm">
              <Button variant="link" onClick={() => setDialog({ kind: 'edit', connection: c })}>
                Edit
              </Button>
              <Button
                variant="link"
                isDisabled={act.busy}
                onClick={async () => {
                  const r = await act.run(() => checkMetaConnection(t, ws, c.id));
                  if (r) put(r.connection);
                }}
              >
                Check
              </Button>
              <Button
                variant="link"
                isDisabled={act.busy}
                onClick={async () => {
                  const r = await act.run(() => retryWebhookSetup(t, ws, c.id));
                  if (r) put(r);
                }}
              >
                Retry webhook setup
              </Button>
              <Button variant="link" isDanger onClick={() => setDialog({ kind: 'delete', connection: c })}>
                Delete
              </Button>
            </div>
          )}
        </section>
      ))}
      {dialog?.kind === 'add' && (
        <MetaConnectionModal
          onSaved={(c) => {
            put(c);
            close();
          }}
          onCancel={close}
        />
      )}
      {dialog?.kind === 'edit' && (
        <MetaConnectionModal
          existing={dialog.connection}
          onSaved={(c) => {
            put(c);
            close();
          }}
          onCancel={close}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${dialog.connection.name}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={act.busy}
          error={act.error}
          onConfirm={async () => {
            const done = await act.run(async () => {
              await deleteMetaConnection(t, ws, dialog.connection.id);
              return true;
            });
            if (done) {
              connections.setData((list) => (list ?? []).filter((x) => x.id !== dialog.connection.id));
              close();
            }
          }}
          onCancel={close}
        >
          Its app secret and token are removed from this app. Meta keeps the app; its numbers must be removed first.
        </ConfirmModal>
      )}
    </>
  );
};
