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
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Authority, AuthorityStatus, NeedsCreating, listAuthorities, listNeedsCreating } from '@app/api/authorities';
import { LEVEL_LABELS } from '@app/api/roles';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { AuthorityStatusLabel } from '@app/Authorities/AuthorityStatusLabel';

type StatusFilter = 'ALL' | AuthorityStatus;

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'All',
  ACTIVE: 'Active',
  NOT_CHECKED: 'Not checked',
  WRONG_LEVEL: 'Wrong level',
};

/** Case-insensitive match on code, group or description. */
export function matchesSearch(a: Pick<Authority, 'code' | 'group' | 'description'>, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [a.code, a.group, a.description].some((s) => s.toLowerCase().includes(q));
}

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

  const shown = (authorities.data ?? []).filter(
    (a) => matchesSearch(a, search) && (status === 'ALL' || a.status === status),
  );

  return (
    <PageShell title="Authorities">
      {authorities.error && <Alert variant="danger" isInline title={authorities.error} />}
      {needsCreating.error && <Alert variant="danger" isInline title={needsCreating.error} />}
      {(needsCreating.data ?? []).length > 0 && (
        <NeedsCreatingPanel items={needsCreating.data ?? []} onCreate={() => undefined} />
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
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </PageShell>
  );
};
