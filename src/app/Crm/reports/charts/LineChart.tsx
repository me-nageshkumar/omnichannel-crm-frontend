import * as React from 'react';
import './charts.css';
import { Tooltip } from './Tooltip';
import { seriesColor, ticks } from './chartText';
import { useChartWidth } from './useChartWidth';

export interface LinePoint {
  x: Date;
  y: number;
}

export interface LineSeries {
  key: string;
  label: string;
  points: LinePoint[];
}

const HEIGHT = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 48 };

/**
 * Up to eight series as 2 px lines in their slot colours, a hairline y grid, a crosshair that snaps to the nearest x
 * and a tooltip listing every series' value there, markers on the hovered x, and a legend for two or more series.
 */
export const LineChart: React.FunctionComponent<{
  title: string;
  period?: string;
  series: LineSeries[];
  formatY(v: number): string;
  formatX(d: Date): string;
}> = ({ title, period, series, formatY, formatX }) => {
  const [box, WIDTH] = useChartWidth();
  const [hover, setHover] = React.useState<{ index: number; x: number; y: number } | null>(null);
  const shown = series.slice(0, 8);
  const xs = React.useMemo(() => {
    const all = new Set<number>();
    shown.forEach((s) => s.points.forEach((p) => all.add(p.x.getTime())));
    return Array.from(all).sort((a, b) => a - b);
  }, [shown]);
  if (xs.length === 0) return null;

  const maxY = Math.max(0, ...shown.flatMap((s) => s.points.map((p) => p.y)));
  const axis = ticks(maxY);
  const top = axis[axis.length - 1] || 1;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const minX = xs[0];
  const spanX = Math.max(xs[xs.length - 1] - minX, 1);
  const px = (t: number) => (xs.length === 1 ? PAD.left + plotW / 2 : PAD.left + ((t - minX) / spanX) * plotW);
  const py = (v: number) => PAD.top + plotH - (plotH * Math.max(v, 0)) / top;
  const valueAt = (s: LineSeries, t: number) => s.points.find((p) => p.x.getTime() === t)?.y;

  const path = (s: LineSeries) =>
    s.points
      .slice()
      .sort((a, b) => a.x.getTime() - b.x.getTime())
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x.getTime()).toFixed(1)} ${py(p.y).toFixed(1)}`)
      .join(' ');

  const nearest = (clientX: number, target: SVGRectElement) => {
    const box = (target.ownerSVGElement ?? target).getBoundingClientRect();
    const scale = box.width > 0 ? WIDTH / box.width : 1;
    const localX = (clientX - box.left) * scale;
    let best = 0;
    xs.forEach((t, i) => {
      if (Math.abs(px(t) - localX) < Math.abs(px(xs[best]) - localX)) best = i;
    });
    return { index: best, x: px(xs[best]) / scale, y: (PAD.top + plotH / 2) / scale };
  };

  // Labels are picked at a fixed step counted back from the last point, so the last two are never neighbours.
  const step = Math.ceil(xs.length / 6);
  const xLabels = xs.length <= 6 ? xs : xs.filter((_, i) => (xs.length - 1 - i) % step === 0);

  return (
    <div className="crm-chart" ref={box}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={period ? `${title}, ${period}` : title}>
        {axis.map((t) => (
          <g key={t}>
            <line className="crm-chart__grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={py(t)} y2={py(t)} />
            <text x={PAD.left - 6} y={py(t)} dy="0.35em" textAnchor="end">
              {formatY(t)}
            </text>
          </g>
        ))}
        {xLabels.map((t) => (
          <text key={t} x={px(t)} y={HEIGHT - 8} textAnchor="middle">
            {formatX(new Date(t))}
          </text>
        ))}
        {shown.map((s, i) => (
          <path key={s.key} className="crm-chart__line" d={path(s)} stroke={seriesColor(i + 1)} />
        ))}
        {hover && (
          <g>
            <line
              className="crm-chart__crosshair"
              x1={px(xs[hover.index])}
              x2={px(xs[hover.index])}
              y1={PAD.top}
              y2={PAD.top + plotH}
            />
            {shown.map((s, i) => {
              const v = valueAt(s, xs[hover.index]);
              return v === undefined ? null : (
                <circle
                  key={s.key}
                  className="crm-chart__marker"
                  cx={px(xs[hover.index])}
                  cy={py(v)}
                  r={4}
                  fill={seriesColor(i + 1)}
                />
              );
            })}
          </g>
        )}
        <rect
          className="crm-chart__hit"
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          onMouseMove={(e) => setHover(nearest(e.clientX, e.currentTarget))}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover({ index: xs.length - 1, x: px(xs[xs.length - 1]), y: PAD.top + plotH / 2 })}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (!hover) return;
            if (e.key === 'ArrowLeft' && hover.index > 0) {
              setHover({ index: hover.index - 1, x: px(xs[hover.index - 1]), y: hover.y });
            } else if (e.key === 'ArrowRight' && hover.index < xs.length - 1) {
              setHover({ index: hover.index + 1, x: px(xs[hover.index + 1]), y: hover.y });
            }
          }}
          tabIndex={0}
        />
      </svg>
      {shown.length >= 2 && (
        <ul className="crm-chart__legend" aria-label="Series">
          {shown.map((s, i) => (
            <li key={s.key}>
              <span className="crm-chart__swatch crm-chart__swatch--line" style={{ background: seriesColor(i + 1) }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {hover && (
        <Tooltip
          title={formatX(new Date(xs[hover.index]))}
          x={hover.x}
          y={hover.y}
          rows={shown.map((s, i) => {
            const v = valueAt(s, xs[hover.index]);
            return { label: s.label, value: v === undefined ? '—' : formatY(v), color: seriesColor(i + 1) };
          })}
        />
      )}
    </div>
  );
};
