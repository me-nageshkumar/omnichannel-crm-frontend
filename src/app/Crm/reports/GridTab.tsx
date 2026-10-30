import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FormGroup,
  FormSelect,
  FormSelectOption,
  FormSelectOptionGroup,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { type GridReport, type GridRequest, type ReportBucket, type ReportFilter, reportGrid } from '@app/api/crm';
import { useFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';
import { BarChart } from '@app/Crm/reports/charts/BarChart';
import { LineChart, type LineSeries } from '@app/Crm/reports/charts/LineChart';
import { compact, day, month, week } from '@app/Crm/reports/charts/chartText';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { ReportTable, money, moneyCompact } from '@app/Crm/reports/cards/cardShared';
import {
  BUCKETS,
  DATE_FIELDS,
  ENTITIES,
  GROUP_BY,
  type GridState,
  METRICS,
  ORDERED_GROUPS,
  customGroupOptions,
  gridFromSearch,
  gridRequest,
  gridToSearch,
  isMoneyField,
  normalizeGrid,
  valueOptions,
} from '@app/Crm/reports/gridFields';

export interface GridTabProps {
  ws: string;
  body: ReportFilter;
  tick: number;
  period: string;
  currency: string;
}

const TITLE = 'Grid';
const MAX_SERIES = 8;
const X_FORMAT: Record<ReportBucket, (d: Date) => string> = { DAY: day, WEEK: week, MONTH: month };

/** The groups' series over the buckets: the seven largest by total and the rest folded into "Other". */
function toSeries(d: GridReport): LineSeries[] {
  const buckets = Array.from(new Set(d.rows.map((r) => r.bucket ?? ''))).sort();
  const totals = new Map<string, { label: string; total: number; cells: Map<string, number> }>();
  for (const r of d.rows) {
    const g = totals.get(r.key) ?? { label: r.label, total: 0, cells: new Map() };
    g.total += r.value;
    g.cells.set(r.bucket ?? '', (g.cells.get(r.bucket ?? '') ?? 0) + r.value);
    totals.set(r.key, g);
  }
  const ranked = Array.from(totals.entries())
    .filter(([key]) => key !== '__other')
    .sort((a, b) => b[1].total - a[1].total);
  const rest = ranked.slice(MAX_SERIES - 1).map(([, g]) => g);
  const other = totals.get('__other');
  if (other) rest.push(other);
  const kept = rest.length > 1 || other ? ranked.slice(0, MAX_SERIES - 1) : ranked;
  const points = (cells: Map<string, number>) => buckets.map((b) => ({ x: new Date(b), y: cells.get(b) ?? 0 }));
  const series: LineSeries[] = kept.map(([key, g]) => ({ key, label: g.label, points: points(g.cells) }));
  if (rest.length > 0 && kept.length < ranked.length + (other ? 1 : 0)) {
    const sum = new Map<string, number>();
    rest.forEach((g) => g.cells.forEach((v, b) => sum.set(b, (sum.get(b) ?? 0) + v)));
    series.push({ key: '__other', label: 'Other', points: points(sum) });
  }
  return series;
}

const GridResult: React.FunctionComponent<{
  ws: string;
  request: GridRequest;
  tick: number;
  period: string;
  currency: string;
  isMoney: boolean;
  keepOrder: boolean;
}> = ({ ws, request, tick, period, currency, isMoney, keepOrder }) => {
  const q = useReport(reportGrid, ws, request, tick);
  const d = q.data;
  const cur = d?.currency || currency;
  const rows = d?.rows ?? [];
  const bucketed = !!d?.dateBucket;
  const formatX = X_FORMAT[d?.dateBucket ?? 'DAY'];
  const short = (v: number) => (isMoney ? moneyCompact(v, cur) : compact(v));
  const full = (v: number) => (isMoney ? money(v, cur) : d?.metric === 'AVG' ? compact(v) : String(v));
  return (
    <ReportCard
      id="grid"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={rows.length === 0}
      emptyText="No records match."
      otherCurrencyDeals={d?.otherCurrencyDeals}
      note={d?.truncated ? 'Showing the 100 largest groups; the rest are in Other.' : undefined}
      chart={
        bucketed && d ? (
          <LineChart title={TITLE} period={period} series={toSeries(d)} formatY={short} formatX={formatX} />
        ) : (
          <BarChart
            title={TITLE}
            period={period}
            keepOrder={keepOrder}
            maxBars={101}
            rows={rows.map((r) => ({
              key: r.key,
              label: r.label,
              value: r.value,
              hint: r.count === 1 ? '1 record' : `${r.count} records`,
            }))}
            format={short}
          />
        )
      }
      table={
        <ReportTable
          label={TITLE}
          columns={bucketed ? ['Group', 'Period', 'Value', 'Count'] : ['Group', 'Value', 'Count']}
          rows={rows.map((r) => ({
            key: `${r.key}#${r.bucket ?? ''}`,
            cells: bucketed
              ? [r.label, formatX(new Date(r.bucket ?? '')), full(r.value), r.count]
              : [r.label, full(r.value), r.count],
          }))}
        />
      }
    />
  );
};

/** The Grid tab: pick a record type, a group, a metric and an optional date split; the figures follow the page's filter. */
export const GridTab: React.FunctionComponent<GridTabProps> = ({ ws, body, tick, period, currency }) => {
  const [params, setParams] = useSearchParams();
  const raw = gridFromSearch(params);
  const fields = useFieldDefinitions(raw.entity);
  const state = normalizeGrid(raw, fields.defs);
  const update = (patch: Partial<GridState>) => {
    const next = normalizeGrid(
      { ...state, ...patch },
      patch.entity && patch.entity !== state.entity ? [] : fields.defs,
    );
    setParams((prev) => gridToSearch(prev, next), { replace: true });
  };
  const customGroups = customGroupOptions(fields.defs, state.entity);
  const values = valueOptions(fields.defs, state.entity);
  const stageBlocked = state.by === 'stage' && !body.pipelineId;

  return (
    <>
      <div className="crm-grid__builder">
        <FormGroup label="Record type" fieldId="crm-grid-entity">
          <FormSelect
            id="crm-grid-entity"
            value={state.entity}
            onChange={(_e, v) => update({ entity: v as GridState['entity'] })}
          >
            {ENTITIES.map((o) => (
              <FormSelectOption key={o.key} value={o.key} label={o.label} />
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup label="Group by" fieldId="crm-grid-by">
          <FormSelect id="crm-grid-by" value={state.by} onChange={(_e, v) => update({ by: v })}>
            {GROUP_BY[state.entity].map((o) => (
              <FormSelectOption key={o.key} value={o.key} label={o.label} />
            ))}
            {customGroups.length > 0 && (
              <FormSelectOptionGroup label="Custom fields">
                {customGroups.map((o) => (
                  <FormSelectOption key={o.key} value={o.key} label={o.label} />
                ))}
              </FormSelectOptionGroup>
            )}
          </FormSelect>
        </FormGroup>
        <FormGroup label="Metric" fieldId="crm-grid-metric">
          <FormSelect
            id="crm-grid-metric"
            value={state.metric}
            onChange={(_e, v) => update({ metric: v as GridState['metric'] })}
          >
            {METRICS.filter((m) => m.key === 'COUNT' || values.length > 0).map((o) => (
              <FormSelectOption key={o.key} value={o.key} label={o.label} />
            ))}
          </FormSelect>
        </FormGroup>
        {state.metric !== 'COUNT' && (
          <FormGroup label="Field" fieldId="crm-grid-field">
            <FormSelect id="crm-grid-field" value={state.field} onChange={(_e, v) => update({ field: v })}>
              {values.map((o) => (
                <FormSelectOption key={o.key} value={o.key} label={o.label} />
              ))}
            </FormSelect>
          </FormGroup>
        )}
        <FormGroup label="Date bucket" fieldId="crm-grid-bucket">
          <FormSelect
            id="crm-grid-bucket"
            value={state.bucket}
            onChange={(_e, v) => update({ bucket: v as GridState['bucket'] })}
          >
            {BUCKETS.map((o) => (
              <FormSelectOption key={o.key} value={o.key} label={o.label} />
            ))}
          </FormSelect>
        </FormGroup>
        {state.bucket && state.entity === 'DEAL' && (
          <FormGroup label="Date field" fieldId="crm-grid-date">
            <FormSelect
              id="crm-grid-date"
              value={state.date}
              onChange={(_e, v) => update({ date: v as GridState['date'] })}
            >
              {DATE_FIELDS.map((o) => (
                <FormSelectOption key={o.key} value={o.key} label={o.label} />
              ))}
            </FormSelect>
          </FormGroup>
        )}
      </div>
      {stageBlocked ? (
        <HelperText>
          <HelperTextItem variant="warning">Stage needs a pipeline.</HelperTextItem>
        </HelperText>
      ) : (
        !fields.loading && (
          <GridResult
            ws={ws}
            request={gridRequest(state, body)}
            tick={tick}
            period={period}
            currency={currency}
            isMoney={state.metric !== 'COUNT' && isMoneyField(fields.defs, state.entity, state.field)}
            keepOrder={ORDERED_GROUPS.has(state.by)}
          />
        )
      )}
    </>
  );
};
