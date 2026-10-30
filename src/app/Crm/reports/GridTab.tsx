import * as React from 'react';
import type { ReportFilter } from '@app/api/crm';

export interface GridTabProps {
  ws: string;
  body: ReportFilter;
  tick: number;
  period: string;
  currency: string;
}

/** The Grid tab: a group-by builder over deals, contacts or companies (built next). */
export const GridTab: React.FunctionComponent<GridTabProps> = () => <p>Grid builder coming next.</p>;
