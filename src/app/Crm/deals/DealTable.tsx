import * as React from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { Deal, Pipeline } from '@app/api/crm';
import { useFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';
import { useBrandUsers } from '@app/Crm/fields/useBrandUsers';
import { fieldColumns } from '@app/Crm/common/fields/fieldColumns';
import { formatMoney } from '@app/Crm/common/money';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { personName } from '@app/Crm/personName';

export const DEAL_PAGE_SIZE = 25;
export type DealSortField = 'title' | 'amount' | 'lastActivityAt';
export interface DealSort {
  field: DealSortField;
  dir: 'asc' | 'desc';
}

const COLUMNS: { label: string; field?: DealSortField }[] = [
  { label: 'Title', field: 'title' },
  { label: 'Contact' },
  { label: 'Stage' },
  { label: 'Amount', field: 'amount' },
  { label: 'Owner' },
  { label: 'Expected close' },
  { label: 'Last activity', field: 'lastActivityAt' },
];

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const closeDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d);
};

/** The deal's route, keeping the page's view and filters ({@code search}) and naming the pipeline. */
export function dealPath(dealId: string, pipelineId: string, search: string): string {
  const params = new URLSearchParams(search);
  params.set('pipelineId', pipelineId);
  return `/crm/deals/${dealId}?${params.toString()}`;
}

/** The deals of a pipeline as a table: sortable on title, amount and last activity, paged. */
export const DealTable: React.FunctionComponent<{
  pipeline: Pipeline;
  deals: Deal[];
  total: number;
  page: number;
  sort: DealSort;
  defaultCurrency?: string | null;
  emptyText: string;
  /** The page's current query string, carried into each deal link. */
  search: string;
  onSort(sort: DealSort): void;
  onSetPage(page: number): void;
}> = ({ pipeline, deals, total, page, sort, defaultCurrency, emptyText, search, onSort, onSetPage }) => {
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? '—';
  const extraColumns = fieldColumns(useFieldDefinitions('DEAL').defs, useBrandUsers());
  const activeIndex = COLUMNS.findIndex((c) => c.field === sort.field);
  return (
    <>
      <Table aria-label="Deals" variant="compact">
        <Thead>
          <Tr>
            {COLUMNS.map((c, i) => (
              <Th
                key={c.label}
                sort={
                  c.field
                    ? {
                        columnIndex: i,
                        sortBy: { index: activeIndex, direction: sort.dir },
                        onSort: (_e, _i, direction) => onSort({ field: c.field as DealSortField, dir: direction }),
                      }
                    : undefined
                }
              >
                {c.label}
              </Th>
            ))}
            {extraColumns.map((col) => (
              <Th key={`cf-${col.key}`}>{col.title}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {deals.length === 0 ? (
            <Tr>
              <Td colSpan={COLUMNS.length + extraColumns.length}>{emptyText}</Td>
            </Tr>
          ) : (
            deals.map((d) => (
              <Tr key={d.id}>
                <Td dataLabel="Title">
                  <Link to={dealPath(d.id, pipeline.id, search)}>{d.title}</Link>
                </Td>
                <Td dataLabel="Contact">{d.primaryContact?.name || d.primaryContact?.phone || '—'}</Td>
                <Td dataLabel="Stage">{stageName(d.stageId)}</Td>
                <Td dataLabel="Amount">{formatMoney(d.amount, d.currency, defaultCurrency) || '—'}</Td>
                <Td dataLabel="Owner">{personName(d.owner) || '—'}</Td>
                <Td dataLabel="Expected close">{closeDate(d.expectedCloseDate)}</Td>
                <Td dataLabel="Last activity">{d.lastActivityAt ? relative(d.lastActivityAt) : '—'}</Td>
                {extraColumns.map((col) => (
                  <Td key={`cf-${col.key}`} dataLabel={col.title}>
                    {col.render(d)}
                  </Td>
                ))}
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
      <Pagination
        itemCount={total}
        perPage={DEAL_PAGE_SIZE}
        perPageOptions={[{ title: String(DEAL_PAGE_SIZE), value: DEAL_PAGE_SIZE }]}
        page={page + 1}
        onSetPage={(_e, p) => onSetPage(p - 1)}
        isCompact
      />
    </>
  );
};
