import * as React from 'react';
import './charts.css';

/** A KPI tile: a sentence-case label, the value, and a subtle line under it. */
export const StatTile: React.FunctionComponent<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div className="crm-stat">
    <span className="crm-stat__label">{label}</span>
    <span className="crm-stat__value">{value}</span>
    {sub && <span className="crm-stat__sub">{sub}</span>}
  </div>
);
