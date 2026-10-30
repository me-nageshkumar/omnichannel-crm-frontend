import * as React from 'react';
import { reportBySource } from '@app/api/crm';
import { BarChart } from '@app/Crm/reports/charts/BarChart';
import { compact } from '@app/Crm/reports/charts/chartText';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable, money } from './cardShared';

const TITLE = 'By source';
const ORIGINS: Record<string, string> = {
  INBOUND_CHAT: 'Inbound chat',
  CTWA_AD: 'Click-to-WhatsApp ad',
  FACEBOOK_LEAD: 'Facebook lead',
  WEBSITE_LEAD: 'Website lead',
  MANUAL: 'Added by hand',
  IMPORT: 'Imported',
  API: 'API',
};

/** Deals won per deal source, with the contacts created per origin under it. */
export const BySourceCard: React.FunctionComponent<CardProps> = ({ ws, body, tick, period, currency }) => {
  const q = useReport(reportBySource, ws, body, tick);
  const d = q.data;
  const cur = d?.currency || currency;
  const deals = d?.deals ?? [];
  const contacts = d?.contacts ?? [];
  const origins = (
    <ReportTable
      label="Contacts by origin"
      compact
      columns={['Origin', 'Contacts created']}
      rows={contacts.map((c) => ({ key: c.originKind, cells: [ORIGINS[c.originKind] ?? c.originKind, c.created] }))}
    />
  );
  return (
    <ReportCard
      id="by-source"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={deals.length === 0 && contacts.length === 0}
      emptyText="No deals or contacts in this period."
      otherCurrencyDeals={d?.otherCurrencyDeals}
      chart={
        <>
          <BarChart
            title={TITLE}
            period={period}
            rows={deals.map((r) => ({
              key: r.source,
              label: r.label,
              value: r.won,
              hint: `${r.created} created · ${money(r.wonAmount, cur)} won`,
            }))}
            format={compact}
          />
          <h4 className="crm-reports__subheading">Contacts by origin</h4>
          {origins}
        </>
      }
      table={
        <>
          <ReportTable
            label={TITLE}
            columns={['Source', 'Created', 'Won', 'Won amount']}
            rows={deals.map((r) => ({ key: r.source, cells: [r.label, r.created, r.won, money(r.wonAmount, cur)] }))}
          />
          <h4 className="crm-reports__subheading">Contacts by origin</h4>
          {origins}
        </>
      }
    />
  );
};
