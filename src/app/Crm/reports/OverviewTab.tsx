import * as React from 'react';
import { Gallery, GalleryItem } from '@patternfly/react-core';
import { type ReportFilter, reportPipelineSummary } from '@app/api/crm';
import { useReport } from '@app/Crm/reports/useReport';
import { KpiRow } from '@app/Crm/reports/cards/KpiRow';
import { PipelineByStageCard } from '@app/Crm/reports/cards/PipelineByStageCard';
import { DealsOverTimeCard } from '@app/Crm/reports/cards/DealsOverTimeCard';
import { ByOwnerCard } from '@app/Crm/reports/cards/ByOwnerCard';
import { BySourceCard } from '@app/Crm/reports/cards/BySourceCard';
import { ByNumberCard } from '@app/Crm/reports/cards/ByNumberCard';
import { LifecycleFunnelCard } from '@app/Crm/reports/cards/LifecycleFunnelCard';
import { ActivityCard } from '@app/Crm/reports/cards/ActivityCard';
import { StageDurationCard } from '@app/Crm/reports/cards/StageDurationCard';
import { CampaignsCard } from '@app/Crm/reports/cards/CampaignsCard';

export interface OverviewProps {
  ws: string;
  body: ReportFilter;
  tick: number;
  period: string;
  currency: string;
}

const WIDE = { gridColumn: '1 / -1' };

/** The Overview tab: the KPI tiles and the nine cards for the filter; the pipeline summary feeds the tiles and the first card. */
export const OverviewTab: React.FunctionComponent<OverviewProps> = ({ ws, body, tick, period, currency }) => {
  const summary = useReport(reportPipelineSummary, ws, body, tick);
  const common = { ws, body, tick, period, currency };
  return (
    <>
      <KpiRow summary={summary} currency={currency} />
      <Gallery hasGutter minWidths={{ default: '100%', md: '420px' }}>
        <GalleryItem>
          <PipelineByStageCard summary={summary} period={period} currency={currency} />
        </GalleryItem>
        <GalleryItem>
          <DealsOverTimeCard {...common} />
        </GalleryItem>
        <GalleryItem>
          <ByOwnerCard {...common} />
        </GalleryItem>
        <GalleryItem>
          <BySourceCard {...common} />
        </GalleryItem>
        <GalleryItem>
          <ByNumberCard {...common} />
        </GalleryItem>
        <GalleryItem>
          <LifecycleFunnelCard {...common} />
        </GalleryItem>
        <GalleryItem style={WIDE}>
          <ActivityCard {...common} />
        </GalleryItem>
        <GalleryItem>
          <StageDurationCard {...common} />
        </GalleryItem>
        <GalleryItem style={WIDE}>
          <CampaignsCard {...common} />
        </GalleryItem>
      </Gallery>
    </>
  );
};
