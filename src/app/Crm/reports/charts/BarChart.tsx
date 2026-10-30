import * as React from 'react';
import './charts.css';
import { Tooltip } from './Tooltip';
import { clip, seriesColor, ticks } from './chartText';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Extra wording for the tooltip (counts, rates). */
  hint?: string;
}

const ROW = 28;
const BAR = 18;
const LABEL_W = 132;
const PAD_RIGHT = 56;
const TOP = 8;
const AXIS = 22;
const WIDTH = 480;

/**
 * Horizontal bars, one hue, largest first (or in the given order), the top three values labelled at the tip, a
 * tooltip per bar with the full label and hint. The chart is an image named after the card; the table view carries
 * every figure.
 */
export const BarChart: React.FunctionComponent<{
  title: string;
  period?: string;
  rows: BarRow[];
  format(v: number): string;
  /** 'mono' (default) for one hue; a slot number paints every bar in that series colour. */
  series?: 'mono' | number;
  keepOrder?: boolean;
  maxBars?: number;
}> = ({ title, period, rows, format, series = 'mono', keepOrder = false, maxBars = 50 }) => {
  const [hover, setHover] = React.useState<{ index: number; x: number; y: number } | null>(null);
  const shown = React.useMemo(() => {
    const ordered = keepOrder ? rows : [...rows].sort((a, b) => b.value - a.value);
    return ordered.slice(0, maxBars);
  }, [rows, keepOrder, maxBars]);
  if (shown.length === 0) return null;

  const max = Math.max(...shown.map((r) => r.value), 0);
  const axis = ticks(max);
  const top = axis[axis.length - 1] || 1;
  const plotW = WIDTH - LABEL_W - PAD_RIGHT;
  const height = TOP + shown.length * ROW + AXIS;
  const x = (v: number) => LABEL_W + (plotW * Math.max(v, 0)) / top;
  const fill = series === 'mono' ? 'var(--crm-mono)' : seriesColor(series);
  const labelled = new Set(
    [...shown]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((r) => r.key),
  );

  return (
    <div className="crm-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={period ? `${title}, ${period}` : title}
        onMouseLeave={() => setHover(null)}
      >
        {axis.map((t) => (
          <g key={t}>
            <line className="crm-chart__grid" x1={x(t)} x2={x(t)} y1={TOP} y2={TOP + shown.length * ROW} />
            <text x={x(t)} y={height - 6} textAnchor="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {shown.map((r, i) => {
          const y = TOP + i * ROW + (ROW - BAR) / 2;
          const w = Math.max(x(r.value) - LABEL_W, 0);
          const hovered = hover?.index === i;
          return (
            <g key={r.key}>
              <text className="crm-chart__label" x={LABEL_W - 8} y={y + BAR / 2} dy="0.35em" textAnchor="end">
                {clip(r.label)}
              </text>
              <rect
                className="crm-chart__hit"
                x={0}
                y={TOP + i * ROW}
                width={WIDTH}
                height={ROW}
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
                  setHover({ index: i, x: e.clientX - box.left, y: e.clientY - box.top });
                }}
                onFocus={() => setHover({ index: i, x: x(r.value), y: y + BAR / 2 })}
                onBlur={() => setHover(null)}
                tabIndex={0}
              >
                <title>{`${r.label}: ${format(r.value)}${r.hint ? ` · ${r.hint}` : ''}`}</title>
              </rect>
              <rect
                className={`crm-chart__bar${hovered ? ' crm-chart__bar--hover' : ''}`}
                x={LABEL_W}
                y={y}
                width={w}
                height={BAR}
                rx={w > 4 ? 4 : 0}
                fill={fill}
                pointerEvents="none"
              />
              {labelled.has(r.key) && r.value > 0 && (
                <text className="crm-chart__value" x={x(r.value) + 6} y={y + BAR / 2} dy="0.35em">
                  {format(r.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && shown[hover.index] && (
        <Tooltip
          title={shown[hover.index].label}
          x={hover.x}
          y={hover.y}
          rows={[
            { label: '', value: format(shown[hover.index].value), color: fill },
            ...(shown[hover.index].hint ? [{ label: shown[hover.index].hint as string, value: '' }] : []),
          ]}
        />
      )}
    </div>
  );
};
