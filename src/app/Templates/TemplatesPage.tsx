import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertActionCloseButton,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import {
  TEMPLATE_TYPES,
  TemplateStatus,
  TemplateType,
  TemplateView,
  archiveTemplate,
  deleteTemplate,
  duplicateTemplate,
  getCategories,
  listTemplates,
  unarchiveTemplate,
} from '@app/api/templates';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { DuplicateModal } from '@app/Templates/DuplicateModal';
import { TYPE_META } from '@app/Templates/typeMeta';

type Dialog = { kind: 'duplicate' | 'delete'; item: TemplateView };

/** A single-select filter: "<Name>: <choice>" toggle over a list of options, with an "All" entry. */
const FilterSelect: React.FunctionComponent<{
  name: string;
  allLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange(value: string): void;
}> = ({ name, allLabel, value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const shown = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <Select
      isOpen={open}
      selected={value}
      onSelect={(_e, v) => {
        onChange(String(v));
        setOpen(false);
      }}
      onOpenChange={setOpen}
      toggle={(ref) => (
        <MenuToggle ref={ref} isExpanded={open} onClick={() => setOpen(!open)}>
          {`${name}: ${shown}`}
        </MenuToggle>
      )}
    >
      <SelectList>
        <SelectOption value="">{allLabel}</SelectOption>
        {options.map((o) => (
          <SelectOption key={o.value} value={o.value}>
            {o.label}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};

/** The current brand's message templates: search, filter, create, and the row actions. */
export const TemplatesPage: React.FunctionComponent = () => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const navigate = useNavigate();
  const canManage = useAccess().hasInWorkspace('template:manage');
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState<TemplateType | ''>('');
  const [category, setCategory] = React.useState('');
  const [status, setStatus] = React.useState<TemplateStatus>('ACTIVE');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const confirm = useAction();

  React.useEffect(() => {
    const timer = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const templates = useLoad(
    (tk) => listTemplates(tk, ws, { q, type, category, status }),
    [ws, q, type, category, status],
  );
  const categories = useLoad((tk) => getCategories(tk, ws), [ws]);
  const items = templates.data ?? [];
  const copyTargets = (user?.workspaces ?? []).filter((w) => !w.disabled && w.authorities.includes('template:manage'));

  const drop = (id: string) => templates.setData((l) => (l ?? []).filter((x) => x.id !== id));
  const open = (kind: Dialog['kind'], item: TemplateView) => () => {
    confirm.reset();
    setDialog({ kind, item });
  };
  const toggleArchive = (item: TemplateView) => async () => {
    const archive = item.status === 'ACTIVE';
    const done = await confirm.run(() => (archive ? archiveTemplate : unarchiveTemplate)(t, ws, item.id));
    if (!done) return;
    drop(item.id);
    setNote(`${archive ? 'Archived' : 'Unarchived'} "${item.name}"`);
  };
  const onDelete = async (item: TemplateView) => {
    const done = await confirm.run(async () => {
      await deleteTemplate(t, ws, item.id);
      return true;
    });
    if (!done) return;
    drop(item.id);
    setDialog(null);
  };

  return (
    <PageShell
      title="Templates"
      actions={
        canManage && (
          <Dropdown
            isOpen={createOpen}
            onSelect={() => setCreateOpen(false)}
            onOpenChange={setCreateOpen}
            toggle={(ref) => (
              <MenuToggle
                ref={ref}
                variant="primary"
                isExpanded={createOpen}
                onClick={() => setCreateOpen(!createOpen)}
              >
                Create template
              </MenuToggle>
            )}
          >
            <DropdownList>
              {TEMPLATE_TYPES.map((tp) => {
                const Icon = TYPE_META[tp].icon;
                return (
                  <DropdownItem key={tp} icon={<Icon />} onClick={() => navigate(`/templates/new?type=${tp}`)}>
                    {TYPE_META[tp].label}
                  </DropdownItem>
                );
              })}
            </DropdownList>
          </Dropdown>
        )
      }
    >
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              aria-label="Search templates"
              placeholder="Search by name"
              value={search}
              onChange={(_e, v) => setSearch(v)}
              onClear={() => setSearch('')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <FilterSelect
              name="Type"
              allLabel="All types"
              value={type}
              options={TEMPLATE_TYPES.map((tp) => ({ value: tp, label: TYPE_META[tp].label }))}
              onChange={(v) => setType(v as TemplateType | '')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <FilterSelect
              name="Category"
              allLabel="All categories"
              value={category}
              options={(categories.data ?? []).map((c) => ({ value: c, label: c }))}
              onChange={setCategory}
            />
          </ToolbarItem>
          <ToolbarItem>
            <ToggleGroup aria-label="Status">
              <ToggleGroupItem text="Active" isSelected={status === 'ACTIVE'} onChange={() => setStatus('ACTIVE')} />
              <ToggleGroupItem
                text="Archived"
                isSelected={status === 'ARCHIVED'}
                onChange={() => setStatus('ARCHIVED')}
              />
            </ToggleGroup>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {note && (
        <Alert
          variant="success"
          isInline
          title={note}
          actionClose={<AlertActionCloseButton onClose={() => setNote(null)} />}
        />
      )}
      {!dialog && confirm.error && <Alert variant="danger" isInline title={confirm.error} />}
      {templates.error && <Alert variant="danger" isInline title={templates.error} />}
      {templates.loading && !templates.data ? (
        <Spinner aria-label="Loading templates" />
      ) : (
        <Table aria-label="Templates" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Category</Th>
              <Th>Placeholders</Th>
              <Th>Last edited</Th>
              {canManage && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <Tr>
                <Td colSpan={canManage ? 6 : 5}>No templates match.</Td>
              </Tr>
            ) : (
              items.map((tpl) => {
                const meta = TYPE_META[tpl.type];
                const Icon = meta.icon;
                return (
                  <Tr key={tpl.id}>
                    <Td dataLabel="Name">
                      <Link to={`/templates/${tpl.id}`}>{tpl.name}</Link>
                      {tpl.warnings.length > 0 && (
                        <Tooltip
                          content={
                            <>
                              {tpl.warnings.map((w) => (
                                <div key={w}>{w}</div>
                              ))}
                            </>
                          }
                        >
                          <span tabIndex={0} aria-label="Has warnings" style={{ marginLeft: 8 }}>
                            <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--warning--default)" />
                          </span>
                        </Tooltip>
                      )}
                    </Td>
                    <Td dataLabel="Type">
                      <Icon /> {meta.label}
                    </Td>
                    <Td dataLabel="Category">{tpl.category ?? '—'}</Td>
                    <Td dataLabel="Placeholders">{tpl.placeholders.length}</Td>
                    <Td dataLabel="Last edited">{`${tpl.updatedBy.name} · ${relative(tpl.lastUpdateTime)}`}</Td>
                    {canManage && (
                      <Td isActionCell>
                        <ActionsColumn
                          items={[
                            { title: 'Edit', onClick: () => navigate(`/templates/${tpl.id}`) },
                            { title: 'Duplicate', onClick: open('duplicate', tpl) },
                            { title: tpl.status === 'ACTIVE' ? 'Archive' : 'Unarchive', onClick: toggleArchive(tpl) },
                            { title: 'Delete', onClick: open('delete', tpl) },
                          ]}
                        />
                      </Td>
                    )}
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'duplicate' && (
        <DuplicateModal
          source={dialog.item}
          targets={copyTargets}
          currentId={ws}
          save={(target, name) => duplicateTemplate(t, ws, dialog.item.id, { targetWorkspaceId: target, name })}
          onSaved={(copy, target) => {
            setDialog(null);
            if (target.id === ws) navigate(`/templates/${copy.id}`);
            else setNote(`Copied to ${target.name}`);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title="Delete template?"
          confirmLabel="Delete"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onDelete(dialog.item)}
          onCancel={() => setDialog(null)}
        >
          {`Delete "${dialog.item.name}"? This cannot be undone.`}
        </ConfirmModal>
      )}
    </PageShell>
  );
};
