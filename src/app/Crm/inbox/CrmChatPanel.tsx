import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { getSettings, inboxSummary, listPipelines, moveDeal, updateContact } from '@app/api/crm';
import { NextTask } from '@app/Crm/tasks/NextTask';
import { TaskFormModal } from '@app/Crm/tasks/TaskFormModal';
import type { CrmSettings, Deal, InboxSummary, Pipeline } from '@app/api/crm';
import { crmMessage } from '@app/Crm/errors';
import { LogActivityForm } from '@app/Crm/activity/LogActivityForm';
import { formatMoney } from '@app/Crm/common/money';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { DealFormModal } from '@app/Crm/deals/DealFormModal';
import { moveMessage } from '@app/Crm/deals/moveMessage';
import { CapturePopover } from '@app/Crm/inbox/CapturePopover';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { useSession } from '@app/session/SessionContext';

const GAP = 'var(--pf-t--global--spacer--sm)';

const BLOCKED: Record<string, string> = {
  CHAT_NOT_ASSIGNED: 'Assign this chat to yourself or your team to capture it.',
  NO_PIPELINE_ACCESS: 'No pipeline is assigned to you yet.',
  NO_EDIT: 'You can view the CRM but not add to it.',
};

type Answer = { chatId: string; summary: InboxSummary } | { chatId: string; error: string };

/**
 * What the CRM knows about the open chat's contact: capture it when it is not yet in the CRM, otherwise its
 * lifecycle, open deals and quick actions. A failure here only shows in the panel; the chat is never blocked.
 */
export const CrmChatPanel: React.FunctionComponent<{ chatId: string }> = ({ chatId }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canEdit = useCrmCan('crm:edit');
  const access = useCrmStatus().status?.pipelineAccess ?? [];
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  const [tick, setTick] = React.useState(0);
  const [refs, setRefs] = React.useState<{ settings: CrmSettings | null; pipelines: Pipeline[] } | null>(null);
  const [refsTick, setRefsTick] = React.useState(0);
  const [logging, setLogging] = React.useState(false);
  const [logged, setLogged] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [planning, setPlanning] = React.useState(false);
  const [moving, setMoving] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  // Which chat is open now: an answer to something started on another chat is dropped.
  const openChat = React.useRef(chatId);
  openChat.current = chatId;

  // An answer for another chat (a late one, or the one shown before the switch) is treated as not loaded.
  React.useEffect(() => {
    if (!token) return undefined;
    let live = true;
    inboxSummary(token, ws, chatId).then(
      (summary) => live && setAnswer({ chatId, summary }),
      (e) => live && setAnswer({ chatId, error: crmMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [token, ws, chatId, tick]);

  // A new chat starts with a clean panel.
  React.useEffect(() => {
    setLogging(false);
    setLogged(false);
    setSaveError(null);
    setMoving(null);
    setCreating(false);
  }, [chatId]);

  const current = answer && answer.chatId === chatId ? answer : null;
  const summary = current && 'summary' in current ? current.summary : null;
  const contact = summary?.contact ?? null;
  const captured = !!contact;

  // Lifecycle labels and stage names are only needed for a captured contact. They change in Settings, in another
  // tab as often as not, so they are read for each chat and again on coming back; a failed read keeps the last ones.
  React.useEffect(() => {
    if (!token || !captured) return undefined;
    let live = true;
    Promise.all([getSettings(token, ws).catch(() => null), listPipelines(token, ws).catch(() => null)]).then(
      ([settings, pipelines]) => {
        if (!live) return;
        setRefs((old) => ({
          settings: settings ?? old?.settings ?? null,
          pipelines: pipelines ?? old?.pipelines ?? [],
        }));
      },
    );
    return () => {
      live = false;
    };
  }, [token, ws, captured, chatId, refsTick]);
  useRefetchOnFocus(() => setRefsTick((t) => t + 1));

  const onLifecycle = async (key: string) => {
    if (!token || !contact) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateContact(token, ws, contact.id, { lifecycleStatus: key, version: contact.version });
      setAnswer((a) =>
        a && 'summary' in a && a.chatId === chatId ? { ...a, summary: { ...a.summary, contact: saved } } : a,
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === 'VERSION_CONFLICT') {
        setSaveError('Someone else changed this contact. It has been refreshed; try again.');
        setTick((t) => t + 1);
      } else {
        setSaveError(crmMessage(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const onStage = async (deal: Deal, stageId: string) => {
    if (!token || stageId === deal.stageId) return;
    const startedOn = chatId;
    setMoving(deal.id);
    setSaveError(null);
    try {
      const moved = await moveDeal(token, ws, deal.id, { stageId });
      if (openChat.current !== startedOn) return;
      // show the new stage now: the select must not fall back to the old one while the summary refreshes
      setAnswer((a) =>
        a && 'summary' in a && a.chatId === startedOn
          ? {
              ...a,
              summary: { ...a.summary, openDeals: a.summary.openDeals.map((d) => (d.id === moved.id ? moved : d)) },
            }
          : a,
      );
      setTick((t) => t + 1);
    } catch (e) {
      if (openChat.current !== startedOn) return;
      setSaveError(moveMessage(e));
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') setTick((t) => t + 1);
    } finally {
      if (openChat.current === startedOn) setMoving(null);
    }
  };

  let body: React.ReactNode;
  if (!current) {
    body = <Spinner size="lg" aria-label="Loading CRM" />;
  } else if ('error' in current) {
    body = (
      <Alert
        variant="danger"
        isInline
        isPlain
        title={current.error}
        actionLinks={
          <Button
            variant="link"
            isInline
            onClick={() => {
              setAnswer(null);
              setTick((t) => t + 1);
            }}
          >
            Retry
          </Button>
        }
      />
    );
  } else if (!contact) {
    const { summary: s } = current;
    body = (
      <div style={{ display: 'grid', gap: GAP }}>
        <div>
          <Title headingLevel="h3" size="md">
            Not in the CRM yet
          </Title>
        </div>
        {s.canCapture ? (
          <div>
            <CapturePopover
              chatId={chatId}
              onCaptured={(result) => {
                // A match with an existing CRM contact may carry other open deals: ask the server for them.
                if (!result.createdContact) {
                  setAnswer(null);
                  setTick((t) => t + 1);
                  return;
                }
                setAnswer({
                  chatId,
                  summary: {
                    ...s,
                    canCapture: false,
                    captureBlockedReason: null,
                    contact: result.contact,
                    openDeals: result.deal ? [result.deal] : s.openDeals,
                  },
                });
              }}
            />
          </div>
        ) : (
          <>
            <div>
              <Button variant="primary" isDisabled>
                Capture to CRM
              </Button>
            </div>
            {s.captureBlockedReason && BLOCKED[s.captureBlockedReason] && (
              <HelperText>
                <HelperTextItem>{BLOCKED[s.captureBlockedReason]}</HelperTextItem>
              </HelperText>
            )}
          </>
        )}
      </div>
    );
  } else {
    const lifecycles = (refs?.settings?.lifecycleStatuses ?? []).filter(
      (l) => l.active || l.key === contact.lifecycleStatus,
    );
    const stageName = (pipelineId: string, stageId: string) =>
      refs?.pipelines.find((p) => p.id === pipelineId)?.stages.find((st) => st.id === stageId)?.name;
    const label = lifecycles.find((l) => l.key === contact.lifecycleStatus)?.label ?? contact.lifecycleStatus;
    const money = (d: Deal) => formatMoney(d.amount, d.currency, refs?.settings?.defaultCurrency);
    const usable = (refs?.pipelines ?? []).filter((p) => p.active && (access === 'ALL' || access.includes(p.id)));
    const firstPipeline = usable.find((p) => p.id === refs?.settings?.defaultPipelineId) ?? usable[0];
    body = (
      <div style={{ display: 'grid', gap: GAP }}>
        <Title headingLevel="h3" size="md">
          <Link to={`/crm/contacts/${encodeURIComponent(contact.id)}`}>
            {contact.name ?? contact.phone ?? 'Contact'}
          </Link>
        </Title>
        {saveError && <Alert variant="warning" isInline isPlain title={saveError} />}
        {canEdit && lifecycles.length > 0 ? (
          <FormSelect
            aria-label="Lifecycle status"
            value={contact.lifecycleStatus ?? ''}
            isDisabled={saving}
            onChange={(_e, v) => onLifecycle(v)}
          >
            {!contact.lifecycleStatus && <FormSelectOption value="" label="No status" isDisabled />}
            {lifecycles.map((l) => (
              <FormSelectOption key={l.key} value={l.key} label={l.label} />
            ))}
          </FormSelect>
        ) : (
          label && <div>{label}</div>
        )}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: GAP }}>
            <strong>Open deals</strong>
            {canEdit && firstPipeline && refs?.settings && (
              <Button variant="link" isInline onClick={() => setCreating(true)}>
                New deal
              </Button>
            )}
          </div>
          {summary && summary.openDeals.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {summary.openDeals.map((d) => {
                // Closing takes a reason and belongs on the deal: a mis-tap here must not lose a deal.
                const stages = (refs?.pipelines.find((p) => p.id === d.pipelineId)?.stages ?? []).filter(
                  (st) => st.type === 'OPEN' || st.id === d.stageId,
                );
                return (
                  <li key={d.id}>
                    <Link to={`/crm/deals/${encodeURIComponent(d.id)}?pipelineId=${encodeURIComponent(d.pipelineId)}`}>
                      {d.title}
                    </Link>
                    {canEdit && stages.length > 0 ? (
                      <>
                        <FormSelect
                          aria-label={`Stage of ${d.title}`}
                          value={d.stageId}
                          isDisabled={moving === d.id}
                          onChange={(_e, v) => void onStage(d, v)}
                        >
                          {stages.map((st) => (
                            <FormSelectOption key={st.id} value={st.id} label={st.name} />
                          ))}
                        </FormSelect>
                        <div>{money(d)}</div>
                      </>
                    ) : (
                      <div>{[stageName(d.pipelineId, d.stageId), money(d)].filter(Boolean).join(' · ')}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>No open deals</div>
          )}
        </div>
        <div>
          <strong>Next task</strong>
          {summary?.nextTask ? <NextTask task={summary.nextTask} /> : <div>No open tasks</div>}
          {canEdit && (
            <div>
              <Button variant="link" isInline onClick={() => setPlanning(true)}>
                Add follow-up
              </Button>
            </div>
          )}
        </div>
        {creating && firstPipeline && refs?.settings && (
          <DealFormModal
            pipeline={firstPipeline}
            pipelines={usable}
            contact={{
              id: contact.id,
              label: contact.name ?? contact.phone ?? 'Contact',
              channelAccountId: contact.channel?.phoneNumberId,
            }}
            settings={refs.settings}
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              setTick((t) => t + 1);
            }}
          />
        )}
        {planning && (
          <TaskFormModal
            target={{ type: 'CONTACT', id: contact.id }}
            taskTypes={refs?.settings?.taskTypes ?? []}
            onClose={() => setPlanning(false)}
            onSaved={() => {
              setPlanning(false);
              // the summary decides which open task is next
              setTick((t) => t + 1);
            }}
          />
        )}
        {logged && <Alert variant="success" isInline isPlain title="Call logged" />}
        {logging ? (
          <LogActivityForm
            target={{ type: 'CONTACT', id: contact.id }}
            onLogged={() => {
              setLogging(false);
              setLogged(true);
            }}
          />
        ) : (
          canEdit && (
            <div>
              <Button variant="secondary" onClick={() => setLogging(true)}>
                Log call
              </Button>
            </div>
          )
        )}
        <div>
          <Button
            variant="link"
            isInline
            component={(props) => <Link {...props} to={`/crm/contacts/${encodeURIComponent(contact.id)}`} />}
          >
            Open in CRM
          </Button>
        </div>
      </div>
    );
  }

  return <div style={{ padding: GAP }}>{body}</div>;
};

export default CrmChatPanel;
