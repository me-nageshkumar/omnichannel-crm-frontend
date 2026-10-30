import * as React from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** The hover readout of a chart: a title line, then value-led rows keyed by a short line of the series colour. */
export const Tooltip: React.FunctionComponent<{
  title: string;
  rows: TooltipRow[];
  x: number;
  y: number;
}> = ({ title, rows, x, y }) => (
  <div className="crm-chart__tooltip" role="tooltip" style={{ left: x, top: y, transform: 'translate(12px, -50%)' }}>
    <div className="crm-chart__tooltip-title">{title}</div>
    {rows.map((r) => (
      <div key={`${r.label}-${r.value}`} className="crm-chart__tooltip-row">
        {r.color && <span className="crm-chart__tooltip-key" style={{ background: r.color }} />}
        <span className="crm-chart__tooltip-value">{r.value}</span>
        <span>{r.label}</span>
      </div>
    ))}
  </div>
);
