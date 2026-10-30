import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Bullseye,
  Button,
  EmptyState,
  EmptyStateBody,
  Spinner,
  Tab,
  TabTitleText,
  Tabs,
} from '@patternfly/react-core';
import { ChartBarIcon } from '@patternfly/react-icons';
import { type Ref, getSettings, listPipelines } from '@app/api/crm';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { useBrandUsers } from '@app/Crm/fields/useBrandUsers';
import { browserTimeZone } from '@app/Crm/tasks/taskDisplay';
import { ReportFilterBar } from '@app/Crm/reports/ReportFilterBar';
import { OverviewTab } from '@app/Crm/reports/OverviewTab';
import { bodyOf, customRangeError, fromSearch, periodLabel, rangeOf, toSearch } from '@app/Crm/reports/reportFilter';
import './reports.css';

const GridTab = React.lazy(() => import('@app/Crm/reports/GridTab').then((m) => ({ default: m.GridTab })));

/** The brand's CRM reports: a filter bar, the Overview cards and the Grid builder, with the filter in the URL. */
export const ReportsPage: React.FunctionComponent = () => {
  const { workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const canPickOwner = useCrmCan('crm:view-all');
  const [params, setParams] = useSearchParams();
  const tz = React.useMemo(browserTimeZone, []);
  const [tick, setTick] = React.useState(0);
  const [tab, setTab] = React.useState<string | number>('overview');
  const refresh = React.useCallback(() => setTick((t) => t + 1), []);
  useRefetchOnFocus(refresh);

  const pipelines = useLoad((t) => listPipelines(t, ws), [ws], { keepOnError: true });
  const settings = useLoad((t) => getSettings(t, ws), [ws], { keepOnError: true });
  const brandUsers = useBrandUsers();

  const access = status?.pipelineAccess ?? [];
  const accessible = (pipelines.data ?? [])
    .filter((p) => access === 'ALL' || access.includes(p.id))
    .sort((a, b) => Number(b.active) - Number(a.active));
  const ready = !!status && !!pipelines.data && !settings.loading;

  if (!ready) {
    return (
      <PageShell title="Reports">
        {pipelines.error ? (
          <Alert
            variant="danger"
            isInline
            title={pipelines.error}
            actionLinks={
              <Button variant="link" isInline onClick={pipelines.reload}>
                Retry
              </Button>
            }
          />
        ) : (
          <Bullseye>
            <Spinner aria-label="Loading reports" />
          </Bullseye>
        )}
      </PageShell>
    );
  }

  if (accessible.length === 0) {
    return (
      <PageShell title="Reports">
        <EmptyState headingLevel="h2" icon={ChartBarIcon} titleText="No pipeline assigned to you. Ask your admin.">
          <EmptyStateBody>Reports cover the deals of the pipelines you can see.</EmptyStateBody>
        </EmptyState>
      </PageShell>
    );
  }

  const fallback =
    accessible.find((p) => p.id === settings.data?.defaultPipelineId) ??
    accessible.find((p) => p.isDefault && p.active) ??
    accessible[0];
  const state = fromSearch(params, { pipelineId: fallback.id });
  if (!accessible.some((p) => p.id === state.pipelineId)) state.pipelineId = fallback.id;
  // A link may name a number the brand no longer has, or an owner the caller may not pick.
  const phones = status?.phones ?? [];
  state.numbers = state.numbers.filter((n) => phones.some((p) => p.phoneNumberId === n));
  if (!canPickOwner) state.ownerId = '';
  const custom = { from: state.from ?? '', to: state.to ?? '' };
  const rangeError = state.preset === 'custom' ? customRangeError(custom) : null;
  const range = rangeOf(state.preset, new Date(), tz, custom);
  const body = range ? bodyOf(state, tz) : null;
  const period = range ? periodLabel(range, tz) : '';
  const currency = settings.data?.defaultCurrency ?? '';
  const owners: Ref[] = brandUsers.filter((u) => u.id !== user?.id).map((u) => ({ id: u.id, name: u.name }));

  return (
    <PageShell title="Reports">
      <ReportFilterBar
        state={state}
        onChange={(next) =>
          setParams(
            (prev) => {
              // The grid's own settings (g.*) ride along with the filter.
              const sp = toSearch(next);
              prev.forEach((v, k) => k.startsWith('g.') && sp.set(k, v));
              return sp;
            },
            { replace: true },
          )
        }
        pipelines={accessible}
        phones={phones}
        owners={owners}
        meId={user?.id ?? ''}
        canPickOwner={canPickOwner}
        onRefresh={refresh}
        error={rangeError}
      />
      <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k)} aria-label="Report views" mountOnEnter>
        <Tab eventKey="overview" title={<TabTitleText>Overview</TabTitleText>}>
          {body && <OverviewTab ws={ws} body={body} tick={tick} period={period} currency={currency} />}
        </Tab>
        <Tab eventKey="grid" title={<TabTitleText>Grid</TabTitleText>}>
          {body && (
            <React.Suspense
              fallback={
                <Bullseye>
                  <Spinner aria-label="Loading" />
                </Bullseye>
              }
            >
              <GridTab ws={ws} body={body} tick={tick} period={period} currency={currency} />
            </React.Suspense>
          )}
        </Tab>
      </Tabs>
    </PageShell>
  );
};
