import * as React from 'react';
import { Alert, Spinner } from '@patternfly/react-core';
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ExchangeAltIcon,
  ExclamationCircleIcon,
  InfoCircleIcon,
  OutlinedCommentsIcon,
  PencilAltIcon,
  PhoneIcon,
  PlusCircleIcon,
  UsersIcon,
} from '@patternfly/react-icons';
import { listActivities } from '@app/api/crm';
import type { Activity, Stage, TargetType } from '@app/api/crm';
import { messageFor } from '@app/api/messages';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { Timeline } from '@app/Crm/common/Timeline';
import type { TimelineItem } from '@app/Crm/common/Timeline';
import { LogActivityForm } from '@app/Crm/activity/LogActivityForm';

const SIZE = 50;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const show = (v: unknown): string => (v === null || v === undefined || v === '' ? 'empty' : String(v));

/** The timeline rows an activity stands for (a field change with several diffs makes one row each). */
export function itemsFor(a: Activity, stages: Stage[], reasonLabels: Record<string, string>): TimelineItem[] {
  const base = { id: a.id, at: a.happenedAt, by: a.actor?.name };
  const p = a.payload ?? {};
  const stageName = (name: unknown, id: unknown) =>
    str(name) ?? stages.find((s) => s.id === id)?.name ?? 'a removed stage';
  switch (a.type) {
    case 'STAGE_CHANGED':
      return [
        {
          ...base,
          icon: <ExchangeAltIcon />,
          title: `Stage changed from ${stageName(p.fromStageName, p.fromStageId)} to ${stageName(p.toStageName, p.toStageId)}`,
        },
      ];
    case 'DEAL_WON':
      return [{ ...base, icon: <CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" />, title: 'Won' }];
    case 'DEAL_LOST': {
      const reason = str(p.lostReason);
      return [
        {
          ...base,
          icon: <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />,
          title: reason ? `Lost — ${reasonLabels[reason] ?? reason}` : 'Lost',
        },
      ];
    }
    case 'CALL_LOGGED':
    case 'CALL':
      return [{ ...base, icon: <PhoneIcon />, title: 'Call', body: a.summary ?? undefined }];
    case 'MEETING_LOGGED':
    case 'MEETING':
      return [{ ...base, icon: <UsersIcon />, title: 'Meeting', body: a.summary ?? undefined }];
    case 'EMAIL_LOGGED':
    case 'EMAIL':
      return [{ ...base, icon: <EnvelopeIcon />, title: 'Email', body: a.summary ?? undefined }];
    case 'LEGACY_NOTE':
      return [{ ...base, icon: <OutlinedCommentsIcon />, title: 'Note (from Contacts)', body: a.summary ?? undefined }];
    case 'NOTE_ADDED':
      return [{ ...base, icon: <OutlinedCommentsIcon />, title: 'Note', body: a.summary ?? undefined }];
    case 'RECORD_CREATED':
      return [{ ...base, icon: <PlusCircleIcon />, title: 'Created', body: a.summary ?? undefined }];
    case 'FIELD_CHANGED': {
      const changes = Array.isArray(p.changes) ? (p.changes as { field?: unknown; from?: unknown; to?: unknown }[]) : [];
      if (changes.length === 0) return [{ ...base, icon: <PencilAltIcon />, title: a.summary ?? 'Changed' }];
      return changes.map((c, i) => ({
        ...base,
        id: `${a.id}:${i}`,
        icon: <PencilAltIcon />,
        title: `Changed ${str(c.field) ?? 'a field'}`,
        body: `${show(c.from)} → ${show(c.to)}`,
      }));
    }
    default:
      return [{ ...base, icon: <InfoCircleIcon />, title: a.summary || a.type }];
  }
}

/**
 * The activity of a record, newest first, with a form to log a call, meeting or email. {@code stages} name
 * stages when an entry lacks the name; {@code reasonLabels} turn lost-reason keys into their labels.
 */
export const CrmTimeline: React.FunctionComponent<{
  target: { type: TargetType; id: string };
  canLog: boolean;
  stages?: Stage[];
  reasonLabels?: Record<string, string>;
}> = ({ target, canLog, stages = [], reasonLabels = {} }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const first = useLoad((t) => listActivities(t, ws, { targetType: target.type, targetId: target.id, page: 0, size: SIZE }), [
    ws,
    target.type,
    target.id,
  ]);
  const [more, setMore] = React.useState<Activity[]>([]);
  const [logged, setLogged] = React.useState<Activity[]>([]);
  const [pages, setPages] = React.useState(1);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [moreError, setMoreError] = React.useState<string | null>(null);

  const all = React.useMemo(() => {
    const seen = new Set<string>();
    return [...logged, ...(first.data?.items ?? []), ...more]
      .filter((a) => !seen.has(a.id) && !!seen.add(a.id))
      .sort((a, b) => Date.parse(b.happenedAt) - Date.parse(a.happenedAt));
  }, [logged, first.data, more]);
  const items = React.useMemo(() => all.flatMap((a) => itemsFor(a, stages, reasonLabels)), [all, stages, reasonLabels]);
  // The total counts activities only; the legacy notes merged into page 0 are not part of it.
  const loadedActivities = all.filter((a) => a.type !== 'LEGACY_NOTE').length;
  const hasMore = !!first.data && loadedActivities < first.data.total + logged.length;

  const loadMore = async () => {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listActivities(token as string, ws, {
        targetType: target.type,
        targetId: target.id,
        page: pages,
        size: SIZE,
      });
      setMore((m) => [...m, ...page.items]);
      setPages((n) => n + 1);
    } catch (e) {
      setMoreError(messageFor(e));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      {canLog && <LogActivityForm target={target} onLogged={(a) => setLogged((l) => [a, ...l])} />}
      {first.error && <Alert variant="danger" isInline title={first.error} />}
      {moreError && <Alert variant="danger" isInline title={moreError} />}
      {first.loading && !first.data ? (
        <Spinner aria-label="Loading timeline" />
      ) : (
        first.data && (
          <Timeline items={items} hasMore={hasMore} onLoadMore={loadMore} loadingMore={loadingMore} emptyText="No activity yet." />
        )
      )}
    </div>
  );
};
