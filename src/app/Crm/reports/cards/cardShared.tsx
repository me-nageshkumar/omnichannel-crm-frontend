import * as React from 'react';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { ReportFilter } from '@app/api/crm';
import { formatMoney } from '@app/Crm/common/money';
import { compact } from '@app/Crm/reports/charts/chartText';

/** What every overview card gets: where to load from, the filter, the refresh tick and the words for the header. */
export interface CardProps {
  ws: string;
  body: ReportFilter;
  tick: number;
  period: string;
  /** The brand's default currency, used when a response names none. */
  currency: string;
}

export const money = (v: number | null | undefined, currency: string): string =>
  v === null || v === undefined ? '—' : formatMoney(v, null, currency) || String(v);

/** "₹150k": the currency's symbol with a compact figure, for axis ticks and bar tips. */
export function moneyCompact(v: number, currency: string): string {
  const symbol = (formatMoney(0, null, currency) || '').replace(/[\d.,\s]+$/u, '');
  return `${symbol}${symbol.length > 1 ? ' ' : ''}${compact(v)}`;
}

export const pct = (ratio: number | null | undefined): string =>
  ratio === null || ratio === undefined ? '—' : `${Math.round(ratio * 100)}%`;

export const dealsWord = (n: number): string => (n === 1 ? '1 deal' : `${n} deals`);

/** "1 Aug 2026": a day in the browser's zone. */
export function longDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(
    new Date(iso),
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}`;
}

export interface TableRow {
  key: string;
  cells: React.ReactNode[];
}

/** The table view of a card: a header row and one row per record, stacked on narrow screens. */
export const ReportTable: React.FunctionComponent<{
  label: string;
  columns: string[];
  rows: TableRow[];
  compact?: boolean;
}> = ({ label, columns, rows, compact: isCompact = false }) => (
  <Table aria-label={label} variant={isCompact ? 'compact' : undefined} gridBreakPoint="grid-md">
    <Thead>
      <Tr>
        {columns.map((c) => (
          <Th key={c}>{c}</Th>
        ))}
      </Tr>
    </Thead>
    <Tbody>
      {rows.map((r) => (
        <Tr key={r.key}>
          {r.cells.map((cell, i) => (
            <Td key={columns[i]} dataLabel={columns[i]}>
              {cell}
            </Td>
          ))}
        </Tr>
      ))}
    </Tbody>
  </Table>
);
