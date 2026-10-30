import * as React from 'react';
import './charts.css';
import { seriesColor } from './chartText';

export interface SegmentPart {
  key: string;
  label: string;
  value: number;
}

/**
 * A thin segmented bar: one whole split into parts, widths by value, 2 px gaps, no text on it (the row beside it
 * carries the figures). A part at zero draws nothing; its slot colour is still reserved so colours follow the part.
 */
export const SegmentedBar: React.FunctionComponent<{ parts: SegmentPart[]; total: number; ariaLabel: string }> = ({
  parts,
  total,
  ariaLabel,
}) => {
  const sum = parts.reduce((n, p) => n + Math.max(p.value, 0), 0);
  const whole = Math.max(total, sum, 1);
  const summary = parts.map((p) => `${p.label} ${p.value}`).join(', ');
  return (
    <div className="crm-segmented" role="img" aria-label={ariaLabel} title={summary}>
      {parts.map((p, i) =>
        p.value > 0 ? (
          <span
            key={p.key}
            className="crm-segmented__part"
            style={{ flexBasis: `${(100 * p.value) / whole}%`, background: seriesColor(i + 1) }}
          />
        ) : null,
      )}
    </div>
  );
};
