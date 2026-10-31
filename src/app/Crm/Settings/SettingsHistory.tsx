import * as React from 'react';
import { Alert, Spinner } from '@patternfly/react-core';
import { settingsHistory } from '@app/api/crm';
import type { Activity } from '@app/api/crm';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { itemsFor } from '@app/Crm/activity/CrmTimeline';
import { Timeline } from '@app/Crm/common/Timeline';
import { crmMessage } from '@app/Crm/errors';

const SIZE = 50;

/** What changed in the CRM settings, newest first. */
export const SettingsHistory: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const first = useLoad((t) => settingsHistory(t, ws, { page: 0, size: SIZE }), [ws]);
  const [more, setMore] = React.useState<Activity[]>([]);
  const [pages, setPages] = React.useState(1);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [moreError, setMoreError] = React.useState<string | null>(null);

  const loadMore = async () => {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await settingsHistory(token as string, ws, { page: pages, size: SIZE });
      setMore((m) => [...m, ...page.items]);
      setPages((n) => n + 1);
    } catch (e) {
      setMoreError(crmMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  if (first.error) return <Alert variant="danger" isInline title={first.error} />;
  if (!first.data) return <Spinner aria-label="Loading history" />;
  const all = [...first.data.items, ...more];
  return (
    <div className="pf-v6-u-mt-md">
      {moreError && <Alert variant="danger" isInline title={moreError} />}
      <Timeline
        items={all.flatMap((a) => itemsFor(a, [], {}))}
        hasMore={all.length < first.data.total}
        onLoadMore={() => void loadMore()}
        loadingMore={loadingMore}
        emptyText="No settings changes yet."
      />
    </div>
  );
};
