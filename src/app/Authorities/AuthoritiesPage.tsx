import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Label,
  MenuToggle,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { ActionsColumn, IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  Authority,
  AuthorityStatus,
  NeedsCreating,
  deleteAuthority,
  listAuthorities,
  listNeedsCreating,
  matchesSearch,
} from '@app/api/authorities';
import { LEVEL_LABELS } from '@app/api/roles';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { AuthorityHistoryModal } from '@app/Authorities/AuthorityHistoryModal';
import { AuthorityModal } from '@app/Authorities/AuthorityModal';
import { AuthorityStatusLabel } from '@app/Authorities/AuthorityStatusLabel';

type Dialog =
  | { kind: 'create'; prefill?: NeedsCreating }
  | { kind: 'edit'; authority: Authority }
  | { kind: 'history'; authority: Authority }
  | { kind: 'delete'; authority: Authority };

/** Why an authority can't be deleted, or null when it can. */
function deleteBlocker(a: Authority): string | null {
  if (a.builtIn) return 'Built-in authorities cannot be deleted.';
  if (a.roles.length > 0) return `In a role (${a.roles.join(', ')}). Remove it from roles first.`;
  return null;
}

function upsertByCode(list: Authority[], item: Authority): Authority[] {
  const rest = list.filter((a) => a.code !== item.code);
  return [...rest, item].sort((a, b) => a.group.localeCompare(b.group) || a.code.localeCompare(b.code));
}

type StatusFilter = 'ALL' | AuthorityStatus;

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'All',
  ACTIVE: 'Active',
  NOT_CHECKED: 'Not checked',
  WRONG_LEVEL: 'Wrong level',
};

const NeedsCreatingPanel: React.FunctionComponent<{
  items: NeedsCreating[];
  onCreate: (item: NeedsCreating) => void;
}> = ({ items, onCreate }) => {
  const title = `Checked in code, not created yet (${items.length})`;
  return (
    <Card role="region" aria-label={title} isCompact>
      <CardTitle>{title}</CardTitle>
      <CardBody>
        <Table aria-label="Needs creating" variant="compact" borders={false}>
          <Tbody>
            {items.map((n) => (
              <Tr key={n.code}>
                <Td dataLabel="Code">
                  <code>{n.code}</code>
                </Td>
                <Td dataLabel="Checked in">{n.checkedIn.join(', ')}</Td>
                <Td isActionCell>
                  <Button variant="secondary" size="sm" onClick={() => onCreate(n)}>
                    Create
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
};

/** Super Admin: every authority, what checks it, and which roles hold it. */
export const AuthoritiesPage: React.FunctionComponent = () => {
  const authorities = useLoad(listAuthorities);
  const needsCreating = useLoad(listNeedsCreating);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<StatusFilter>('ALL');
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const { token } = useSession();
  const remove = useAction();

  const groups = Array.from(new Set((authorities.data ?? []).map((a) => a.group))).sort();

  const actionsFor = (a: Authority): IAction[] => {
    const blocker = deleteBlocker(a);
    return [
      { title: 'Edit', onClick: () => setDialog({ kind: 'edit', authority: a }) },
      { title: 'History', onClick: () => setDialog({ kind: 'history', authority: a }) },
      {
        title: 'Delete',
        isAriaDisabled: blocker !== null,
        tooltipProps: blocker ? { content: blocker } : undefined,
        onClick: () => {
          remove.reset();
          setDialog({ kind: 'delete', authority: a });
        },
      },
    ];
  };

  const onDelete = async (a: Authority) => {
    const done = await remove.run(async () => {
      await deleteAuthority(token as string, a.code);
      return true;
    });
    if (done) {
      authorities.setData((list) => (list ?? []).filter((x) => x.code !== a.code));
      needsCreating.reload();
      setDialog(null);
    }
  };

  const shown = (authorities.data ?? []).filter(
    (a) => matchesSearch(a, search) && (status === 'ALL' || a.status === status),
  );

  return (
    <PageShell
      title="Authorities"
      actions={
        <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
          Add authority
        </Button>
      }
    >
      {authorities.error && <Alert variant="danger" isInline title={authorities.error} />}
      {needsCreating.error && <Alert variant="danger" isInline title={needsCreating.error} />}
      {(needsCreating.data ?? []).length > 0 && (
        <NeedsCreatingPanel
          items={needsCreating.data ?? []}
          onCreate={(n) => setDialog({ kind: 'create', prefill: n })}
        />
      )}
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              aria-label="Search authorities"
              placeholder="Search by code, group or description"
              value={search}
              onChange={(_e, v) => setSearch(v)}
              onClear={() => setSearch('')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Select
              isOpen={statusOpen}
              selected={status}
              onSelect={(_e, v) => {
                setStatus(v as StatusFilter);
                setStatusOpen(false);
              }}
              onOpenChange={setStatusOpen}
              toggle={(ref) => (
                <MenuToggle ref={ref} isExpanded={statusOpen} onClick={() => setStatusOpen(!statusOpen)}>
                  {`Status: ${STATUS_LABELS[status]}`}
                </MenuToggle>
              )}
            >
              <SelectList>
                {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                  <SelectOption key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {authorities.loading && !authorities.data ? (
        <Spinner aria-label="Loading authorities" />
      ) : (
        <Table aria-label="Authorities" variant="compact">
          <Thead>
            <Tr>
              <Th width={20}>Code</Th>
              <Th width={10}>Group</Th>
              <Th width={10}>Level</Th>
              <Th>Description</Th>
              <Th width={10}>Status</Th>
              <Th width={10}>Roles</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {shown.map((a) => (
              <Tr key={a.code}>
                <Td dataLabel="Code">
                  <code>{a.code}</code>{' '}
                  {a.builtIn && (
                    <Label isCompact color="blue">
                      Built-in
                    </Label>
                  )}
                </Td>
                <Td dataLabel="Group">{a.group}</Td>
                <Td dataLabel="Level">{LEVEL_LABELS[a.level]}</Td>
                <Td dataLabel="Description">{a.description}</Td>
                <Td dataLabel="Status">
                  <AuthorityStatusLabel authority={a} />
                </Td>
                <Td dataLabel="Roles">
                  {a.roles.length > 0 ? (
                    <Tooltip content={a.roles.join(', ')}>
                      <span tabIndex={0}>{a.roles.length}</span>
                    </Tooltip>
                  ) : (
                    0
                  )}
                </Td>
                <Td isActionCell>
                  <ActionsColumn items={actionsFor(a)} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <AuthorityModal
          mode={dialog.kind}
          authority={dialog.kind === 'edit' ? dialog.authority : undefined}
          prefill={dialog.kind === 'create' ? dialog.prefill : undefined}
          needsCreating={needsCreating.data ?? []}
          groups={groups}
          onSaved={(saved) => {
            authorities.setData((list) => upsertByCode(list ?? [], saved));
            if (dialog.kind === 'create') needsCreating.reload();
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'history' && (
        <AuthorityHistoryModal authority={dialog.authority} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${dialog.authority.code}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={remove.busy}
          error={remove.error}
          onConfirm={() => onDelete(dialog.authority)}
          onCancel={() => setDialog(null)}
        >
          The authority is removed. No role holds it, so no one loses access.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
