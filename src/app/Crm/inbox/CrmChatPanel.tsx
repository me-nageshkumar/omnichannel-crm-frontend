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
import { getSettings, inboxSummary, listPipelines, updateContact } from '@app/api/crm';
import { NextTask } from '@app/Crm/tasks/NextTask';
import { TaskFormModal } from '@app/Crm/tasks/TaskFormModal';
import type { CrmSettings, InboxSummary, Pipeline } from '@app/api/crm';
import { crmMessage } from '@app/Crm/errors';
import { LogActivityForm } from '@app/Crm/activity/LogActivityForm';
import { formatMoney } from '@app/Crm/common/money';
import { CapturePopover } from '@app/Crm/inbox/CapturePopover';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';
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
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  const [tick, setTick] = React.useState(0);
  const [refs, setRefs] = React.useState<{ settings: CrmSettings | null; pipelines: Pipeline[] } | null>(null);
  const [logging, setLogging] = React.useState(false);
  const [logged, setLogged] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [planning, setPlanning] = React.useState(false);

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
  }, [chatId]);

  const current = answer && answer.chatId === chatId ? answer : null;
  const summary = current && 'summary' in current ? current.summary : null;
  const contact = summary?.contact ?? null;

  // Lifecycle labels and stage names are only needed for a captured contact.
  React.useEffect(() => {
    if (!token || !contact || refs) return undefined;
    let live = true;
    Promise.all([
      getSettings(token, ws).catch(() => null),
      listPipelines(token, ws).catch(() => [] as Pipeline[]),
    ]).then(([settings, pipelines]) => live && setRefs({ settings, pipelines }));
    return () => {
      live = false;
    };
  }, [token, ws, contact, refs]);

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
          <strong>Open deals</strong>
          {summary && summary.openDeals.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {summary.openDeals.map((d) => (
                <li key={d.id}>
                  <Link to={`/crm/deals/${encodeURIComponent(d.id)}?pipelineId=${encodeURIComponent(d.pipelineId)}`}>
                    {d.title}
                  </Link>
                  <div>
                    {[
                      stageName(d.pipelineId, d.stageId),
                      formatMoney(d.amount, d.currency, refs?.settings?.defaultCurrency),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </li>
              ))}
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
