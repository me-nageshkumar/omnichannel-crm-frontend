import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  AlertActionLink,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  Label,
  MenuToggle,
  Spinner,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { ApiError } from '@app/api/client';
import { deleteRule, listRules, publishRule, unpublishRule } from '@app/api/automations';
import type { RuleSummary } from '@app/api/automations';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { eventLabel, statusColor, statusLabel } from '@app/Automations/automationDisplay';

export const EMPTY_TEXT =
  'No rules yet. A rule sends a template, assigns the chat or adds the person to the CRM when a message comes in or a deal moves.';

type Item = { key: string; label: string; to?: string; run?: () => void };

const RowActions: React.FunctionComponent<{ rule: RuleSummary; items: Item[] }> = ({ rule, items }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={() => setOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          variant="plain"
          aria-label={`Actions for ${rule.name}`}
          isExpanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
    >
      <DropdownList>
        {items.map((i) =>
          i.to ? (
            <DropdownItem key={i.key} to={i.to}>
              {i.label}
            </DropdownItem>
          ) : (
            <DropdownItem key={i.key} onClick={i.run}>
              {i.label}
            </DropdownItem>
          ),
        )}
      </DropdownList>
    </Dropdown>
  );
};

/** The rules table with its row actions. */
export const RulesTab: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('automation:manage');
  const list = useLoad((tk) => listRules(tk, ws), [ws]);
  const { token } = useSession();
  const change = useAction();
  const confirm = useAction();
  const [deleting, setDeleting] = React.useState<RuleSummary | null>(null);
  const [refused, setRefused] = React.useState<{ rule: RuleSummary; messages: string[] } | null>(null);

  const toggle = async (rule: RuleSummary) => {
    if (!token) return;
    setRefused(null);
    const publishing = rule.status === 'DRAFT';
    const ok = await change.run(
      async () => {
        try {
          await (publishing ? publishRule(token, ws, rule.id) : unpublishRule(token, ws, rule.id));
          return true;
        } catch (e) {
          if (publishing && e instanceof ApiError && e.status === 400) {
            setRefused({ rule, messages: Object.values(e.fields ?? {}) });
            return false;
          }
          throw e;
        }
      },
      () => `Could not change ${rule.name}. Try again.`,
    );
    if (ok) list.reload();
  };

  const remove = async () => {
    if (!deleting || !token) return;
    const done = await confirm.run(() => deleteRule(token, ws, deleting.id).then(() => true));
    if (done) {
      setDeleting(null);
      list.reload();
    }
  };

  const itemsFor = (r: RuleSummary): Item[] => {
    const draft = r.status === 'DRAFT';
    const items: Item[] = [{ key: 'edit', label: canManage ? 'Edit' : 'View', to: `/automations/${r.id}` }];
    if (canManage && draft) items.push({ key: 'test', label: 'Test', to: `/automations/${r.id}/test` });
    items.push({ key: 'runs', label: 'Runs', to: `/automations/${r.id}/runs` });
    if (canManage) {
      items.push({ key: 'toggle', label: draft ? 'Publish' : 'Move to draft', run: () => void toggle(r) });
      if (draft)
        items.push({
          key: 'delete',
          label: 'Delete',
          run: () => {
            confirm.reset();
            setDeleting(r);
          },
        });
    }
    return items;
  };

  let body: React.ReactNode;
  if (list.error) body = <Alert variant="danger" isInline title={list.error} />;
  else if (!list.data) body = <Spinner aria-label="Loading rules" />;
  else if (list.data.length === 0) body = <EmptyState headingLevel="h2" titleText={EMPTY_TEXT} />;
  else
    body = (
      <Table aria-label="Rules" variant="compact">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>When</Th>
            <Th>Status</Th>
            <Th>Priority</Th>
            <Th>Last run</Th>
            <Th>Runs (7 days)</Th>
            <Th>Failures (7 days)</Th>
            <Th screenReaderText="Actions" />
          </Tr>
        </Thead>
        <Tbody>
          {list.data.map((r) => (
            <Tr key={r.id}>
              <Td dataLabel="Name">
                <Link to={`/automations/${r.id}`}>{r.name}</Link>
                <div className="pf-v6-u-font-size-sm pf-v6-u-color-200">{r.actionsSummary}</div>
              </Td>
              <Td dataLabel="When">{eventLabel(r.event)}</Td>
              <Td dataLabel="Status">
                <Label color={statusColor(r.status)}>{statusLabel(r.status)}</Label>
              </Td>
              <Td dataLabel="Priority">{r.priority ?? '—'}</Td>
              <Td dataLabel="Last run">{r.lastRunAt ? relative(r.lastRunAt) : 'Never'}</Td>
              <Td dataLabel="Runs (7 days)">{r.runs7d}</Td>
              <Td dataLabel="Failures (7 days)">{r.failures7d}</Td>
              <Td isActionCell>
                <RowActions rule={r} items={itemsFor(r)} />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    );

  return (
    <>
      {change.error && <Alert variant="danger" isInline title={change.error} className="pf-v6-u-mb-md" />}
      {refused && (
        <Alert
          variant="danger"
          isInline
          title={`${refused.rule.name} cannot be published`}
          className="pf-v6-u-mb-md"
          actionLinks={
            <AlertActionLink component={(props) => <Link {...props} to={`/automations/${refused.rule.id}`} />}>
              Open the rule
            </AlertActionLink>
          }
        >
          <ul>
            {refused.messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}
      {body}
      {deleting && (
        <ConfirmModal
          title={`Delete rule “${deleting.name}”?`}
          confirmLabel="Delete"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        >
          Its runs stay in the history.
        </ConfirmModal>
      )}
    </>
  );
};
