import * as React from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  EmptyState,
  FormSelect,
  FormSelectOption,
  Label,
  SearchInput,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { getBoard, getSettings, listPipelines, moveDeal, searchDeals } from '@app/api/crm';
import type { Board, Deal, Lane, Page, Pipeline, Ref } from '@app/api/crm';
import { crmMessage } from '@app/Crm/errors';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { KanbanBoard } from '@app/Crm/common/KanbanBoard';
import type { KanbanLaneData } from '@app/Crm/common/kanban';
import { formatMoney } from '@app/Crm/common/money';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { DealCard } from '@app/Crm/deals/DealCard';
import { DEAL_PAGE_SIZE, DealSort, DealTable } from '@app/Crm/deals/DealTable';
import { DealFormModal } from '@app/Crm/deals/DealFormModal';
import { NewContactModal } from '@app/Crm/deals/NewContactModal';
import { DealDrawer } from '@app/Crm/deals/DealDrawer';
import { moveMessage } from '@app/Crm/deals/moveMessage';

export { moveMessage };

const PER_STAGE = 25;
const NEVER = <T,>(): Promise<T> => new Promise<T>(() => undefined);

const storageKey = (userId: string, ws: string) => `crm.pipeline.${userId}.${ws}`;
function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Remembering the pipeline is a convenience only.
  }
}

/**
 * {@code lanes} with the moved {@code deal} (as the server answered) put below {@code beforeId} or above
 * {@code afterId} in its stage; totals and sums follow.
 */
export function applyMove(lanes: Lane[], deal: Deal, beforeId: string | null, afterId: string | null): Lane[] {
  return lanes.map((lane) => {
    const old = lane.deals.find((d) => d.id === deal.id);
    const here = lane.stage.id === deal.stageId;
    if (!old && !here) return lane;
    const rest = lane.deals.filter((d) => d.id !== deal.id);
    let deals = rest;
    if (here) {
      const before = beforeId ? rest.findIndex((d) => d.id === beforeId) : -1;
      const after = afterId ? rest.findIndex((d) => d.id === afterId) : -1;
      const at = before >= 0 ? before + 1 : after >= 0 ? after : afterId || !beforeId ? 0 : rest.length;
      deals = [...rest.slice(0, at), deal, ...rest.slice(at)];
    }
    return {
      ...lane,
      deals,
      total: lane.total + (here ? 1 : 0) - (old ? 1 : 0),
      sumAmount: lane.sumAmount + (here ? (deal.amount ?? 0) : 0) - (old ? (old.amount ?? 0) : 0),
    };
  });
}

type View = 'board' | 'table';

/** The brand's pipelines: a board of lanes (drag to move) or a table, with search and owner filters. */
export const PipelinesPage: React.FunctionComponent = () => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const { status } = useCrmStatus();
  const canEdit = useCrmCan('crm:edit');
  const navigate = useNavigate();
  const location = useLocation();
  const { dealId } = useParams();
  const [params, setParams] = useSearchParams();

  const pipelines = useLoad((tk) => listPipelines(tk, ws), [ws]);
  const settings = useLoad((tk) => getSettings(tk, ws), [ws]);
  const access = status?.pipelineAccess ?? [];
  const phones = status?.phones ?? [];
  const accessible = (pipelines.data ?? []).filter(
    (p) => p.active && (access === 'ALL' || access.includes(p.id)),
  );
  const ready = !!pipelines.data && !settings.loading;
  const key = storageKey(user?.id ?? '', ws);
  const find = (id: string | null | undefined) => accessible.find((p) => p.id === id);
  const pipeline: Pipeline | undefined = ready
    ? (find(params.get('pipelineId')) ??
      find(readStored(key)) ??
      find(settings.data?.defaultPipelineId) ??
      accessible.find((p) => p.isDefault) ??
      accessible[0])
    : undefined;
  const defaultCurrency = settings.data?.defaultCurrency;

  const view: View = params.get('view') === 'table' ? 'table' : 'board';
  const ownerId = params.get('owner') ?? '';
  const qParam = params.get('q') ?? '';
  const [search, setSearch] = React.useState(qParam);
  const [sort, setSort] = React.useState<DealSort>({ field: 'lastActivityAt', dir: 'desc' });
  const [page, setPage] = React.useState(0);
  const [notice, setNotice] = React.useState<{ variant: 'danger' | 'success'; text: string } | null>(null);
  const [adding, setAdding] = React.useState<'contact' | 'deal' | null>(null);
  const [seenOwners, setSeenOwners] = React.useState<Ref[]>([]);

  const update = (change: (next: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        change(next);
        return next;
      },
      { replace: true },
    );
  const setOrDelete = (next: URLSearchParams, name: string, value: string) =>
    value ? next.set(name, value) : next.delete(name);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (search === qParam) return;
      update((n) => setOrDelete(n, 'q', search.trim()));
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const q = qParam;
  const pipelineId = pipeline?.id;
  const board = useLoad(
    (tk) =>
      pipelineId && view === 'board'
        ? getBoard(tk, ws, { pipelineId, perStageLimit: PER_STAGE, ownerId: ownerId || undefined, q: q || undefined })
        : NEVER<Board>(),
    [ws, pipelineId, view === 'board', ownerId, q],
  );
  const table = useLoad(
    (tk) =>
      pipelineId && view === 'table'
        ? searchDeals(tk, ws, {
            pipelineId,
            ownerId: ownerId || undefined,
            q: q || undefined,
            sort: `${sort.field},${sort.dir}`,
            page,
            size: DEAL_PAGE_SIZE,
          })
        : NEVER<Page<Deal>>(),
    [ws, pipelineId, view === 'table', ownerId, q, sort.field, sort.dir, page],
  );
  const active = view === 'board' ? board : table;
  useRefetchOnFocus(() => active.reload());

  // The lanes as shown: the loaded board, then local moves and "load more" pages on top of it.
  const [shown, setShown] = React.useState<{ pipelineId: string; lanes: Lane[] } | null>(null);
  const loadingMore = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!board.data) return;
    setShown({ pipelineId: pipelineId ?? board.data.pipelineId, lanes: board.data.lanes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.data]);
  const lanes = shown && shown.pipelineId === pipelineId ? shown.lanes : null;

  React.useEffect(() => {
    const deals = [...(lanes ?? []).flatMap((l) => l.deals), ...(table.data?.items ?? [])];
    setSeenOwners((cur) => {
      const add = deals.flatMap((d) => (d.owner && !cur.some((o) => o.id === d.owner?.id) ? [d.owner] : []));
      const fresh = add.filter((o, i) => add.findIndex((x) => x.id === o.id) === i);
      return fresh.length > 0 ? [...cur, ...fresh] : cur;
    });
  }, [lanes, table.data]);

  const kanbanLanes = React.useMemo<KanbanLaneData<Deal>[] | null>(
    () =>
      lanes?.map((l) => ({
        key: l.stage.id,
        title: l.stage.name,
        color: l.stage.color ?? undefined,
        total: l.total,
        cards: l.deals,
        footer: <span title="Total value">{formatMoney(l.sumAmount, null, defaultCurrency)}</span>,
        badge:
          l.stage.wipLimit != null && l.total > l.stage.wipLimit ? (
            <Label isCompact color="red">{`Over the WIP limit of ${l.stage.wipLimit}`}</Label>
          ) : undefined,
      })) ?? null,
    [lanes, defaultCurrency],
  );

  const open = (d: Deal) => navigate(`/crm/deals/${d.id}?pipelineId=${encodeURIComponent(d.pipelineId)}`);

  const onMove = async (id: string, to: string, before: string | null, after: string | null) => {
    setNotice(null);
    try {
      const moved = await moveDeal(t, ws, id, {
        stageId: to,
        ...(before ? { beforeDealId: before } : {}),
        ...(after ? { afterDealId: after } : {}),
      });
      // The board must see these lanes only after it has settled the move, so give them in the next task.
      setTimeout(() => setShown((s) => s && { ...s, lanes: applyMove(s.lanes, moved, before, after) }), 0);
    } catch (e) {
      setNotice({ variant: 'danger', text: moveMessage(e) });
      board.reload();
      throw e;
    }
  };

  const onLoadMore = async (laneKey: string) => {
    if (!pipelineId || loadingMore.current.has(laneKey)) return;
    loadingMore.current.add(laneKey);
    // Paged by what is loaded, not by clicks: a move shifts the server's offsets, and deduping covers the overlap.
    const next = Math.floor((lanes?.find((l) => l.stage.id === laneKey)?.deals.length ?? 0) / PER_STAGE);
    try {
      const result = await searchDeals(t, ws, {
        pipelineId,
        stageId: laneKey,
        ownerId: ownerId || undefined,
        q: q || undefined,
        sort: 'position,asc',
        page: next,
        size: PER_STAGE,
      });
      setShown(
        (s) =>
          s && {
            ...s,
            lanes: s.lanes.map((l) =>
              l.stage.id === laneKey
                ? { ...l, deals: [...l.deals, ...result.items.filter((d) => !l.deals.some((x) => x.id === d.id))] }
                : l,
            ),
          },
      );
    } catch (e) {
      setNotice({ variant: 'danger', text: crmMessage(e) });
    } finally {
      loadingMore.current.delete(laneKey);
    }
  };

  const choosePipeline = (id: string) => {
    writeStored(key, id);
    update((n) => {
      n.set('pipelineId', id);
      n.delete('owner');
    });
    setPage(0);
  };

  const noPipelines = ready && accessible.length === 0;
  const filtering = !!ownerId || !!q;
  const ownerChoices = seenOwners.filter((o) => o.id !== user?.id);
  const canNewDeal = canEdit && access === 'ALL' && !!pipeline;

  const actions = pipeline && (
    <>
      <Button variant="plain" aria-label="Refresh" icon={<SyncAltIcon />} onClick={() => active.reload()} />{' '}
      {canNewDeal && (
        <Button variant="secondary" onClick={() => setAdding('deal')}>
          New deal
        </Button>
      )}{' '}
      {canEdit && (
        <Button variant="primary" onClick={() => setAdding('contact')}>
          New contact
        </Button>
      )}
    </>
  );

  let body: React.ReactNode;
  if (pipelines.error) body = <Alert variant="danger" isInline title={pipelines.error} />;
  else if (noPipelines) body = <EmptyState headingLevel="h2" titleText="No pipeline assigned to you. Ask your admin." />;
  else if (!pipeline) body = <Spinner aria-label="Loading pipelines" />;
  else if (view === 'table') {
    body = table.data ? (
      <DealTable
        pipeline={pipeline}
        deals={table.data.items}
        total={table.data.total}
        page={page}
        sort={sort}
        defaultCurrency={defaultCurrency}
        emptyText={filtering ? 'No deals match.' : 'No deals in this pipeline yet'}
        onSort={(s) => {
          setSort(s);
          setPage(0);
        }}
        onSetPage={setPage}
      />
    ) : table.error ? (
      <Alert variant="danger" isInline title={table.error} />
    ) : (
      <Spinner aria-label="Loading deals" />
    );
  } else if (kanbanLanes) {
    body =
      !filtering && kanbanLanes.every((l) => l.total === 0) ? (
        <EmptyState headingLevel="h2" titleText="No deals in this pipeline yet" />
      ) : (
        <KanbanBoard<Deal>
          lanes={kanbanLanes}
          idOf={(d) => d.id}
          labelOf={(d) => d.title}
          renderCard={(d) => <DealCard deal={d} defaultCurrency={defaultCurrency} phones={phones} onOpen={open} />}
          onMove={onMove}
          onLoadMore={onLoadMore}
          ariaLabel="Deals board"
        />
      );
  } else {
    body = board.error ? <Alert variant="danger" isInline title={board.error} /> : <Spinner aria-label="Loading board" />;
  }

  const pageContent = (
    <PageShell title="Pipelines" actions={actions}>
      {notice && (
        <Alert
          variant={notice.variant}
          isInline
          title={notice.text}
          actionClose={<AlertActionCloseButton onClose={() => setNotice(null)} />}
        />
      )}
      {pipeline && (
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <FormSelect aria-label="Pipeline" value={pipeline.id} onChange={(_e, v) => choosePipeline(v)}>
                {accessible.map((p) => (
                  <FormSelectOption key={p.id} value={p.id} label={p.name} />
                ))}
              </FormSelect>
            </ToolbarItem>
            <ToolbarItem>
              <ToggleGroup aria-label="View">
                <ToggleGroupItem
                  text="Board"
                  buttonId="crm-view-board"
                  isSelected={view === 'board'}
                  onChange={() => update((n) => n.delete('view'))}
                />
                <ToggleGroupItem
                  text="Table"
                  buttonId="crm-view-table"
                  isSelected={view === 'table'}
                  onChange={() => update((n) => n.set('view', 'table'))}
                />
              </ToggleGroup>
            </ToolbarItem>
            <ToolbarItem>
              <SearchInput
                aria-label="Search deals"
                placeholder="Search deals"
                value={search}
                onChange={(_e, v) => setSearch(v)}
                onClear={() => setSearch('')}
              />
            </ToolbarItem>
            <ToolbarItem>
              <FormSelect
                aria-label="Owner"
                value={ownerId}
                onChange={(_e, v) => {
                  update((n) => setOrDelete(n, 'owner', v));
                  setPage(0);
                }}
              >
                <FormSelectOption value="" label="Anyone" />
                {user && <FormSelectOption value={user.id} label="Me" />}
                {ownerChoices.map((o) => (
                  <FormSelectOption key={o.id} value={o.id} label={o.name} />
                ))}
              </FormSelect>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      )}
      {body}
      {adding === 'contact' && pipeline && (
        <NewContactModal
          pipelineId={pipeline.id}
          pipelineName={pipeline.name}
          numbers={phones}
          onClose={() => setAdding(null)}
          onCreated={(r) => {
            setAdding(null);
            setNotice({
              variant: 'success',
              text: r.createdDeal
                ? `Contact added to ${pipeline.name}`
                : `This contact already has a deal in ${pipeline.name}`,
            });
            active.reload();
          }}
        />
      )}
      {adding === 'deal' && pipeline && settings.data && (
        <DealFormModal
          pipeline={pipeline}
          settings={settings.data}
          owners={ownerChoices}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            setNotice({ variant: 'success', text: 'Deal created' });
            active.reload();
          }}
        />
      )}
    </PageShell>
  );

  return (
    <DealDrawer
      dealId={dealId}
      pipelines={pipelines.data ?? []}
      settings={settings.data}
      // A reload hands the board a new lanes reference, so it settles on what the server now has.
      onChanged={() => active.reload()}
      onClose={() => navigate({ pathname: '/crm', search: location.search })}
    >
      {pageContent}
    </DealDrawer>
  );
};
