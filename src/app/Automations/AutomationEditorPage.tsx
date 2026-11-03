import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionGroup,
  Alert,
  AlertActionLink,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { createRule, getRule, publishRule, unpublishRule, updateRule } from '@app/api/automations';
import type {
  AutomationAction,
  AutomationOptions,
  ConditionGroup,
  ConditionNode,
  EventKind,
  Rule,
  RuleRequest,
} from '@app/api/automations';
import { PageShell } from '@app/admin/PageShell';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { EVENTS, conditionErrors, emptyRule, isGroup, pruneConditions } from '@app/Automations/automationModel';
import { eventLabel, statusColor, statusLabel } from '@app/Automations/automationDisplay';
import { ActionList } from '@app/Automations/ActionList';
import { ConditionTreeEditor } from '@app/Automations/ConditionTreeEditor';
import { useAutomationOptions } from '@app/Automations/useAutomationOptions';

const LIST = '/automations';
export const PUBLISHED_TEXT = 'Published rules cannot be edited. Move the rule to draft to change it.';
export const PRIORITY_HELP = 'Rules with a priority run first, largest first; the rest in the order they were made.';
export const CHANGE_EVENT_TEXT = 'Changing the event clears the conditions and removes Add to CRM.';
/** The field errors the form shows next to its own fields; conditions and actions go to their rows and cards. */
const SHOWN = ['name', 'description', 'priority', 'event', 'actions'];
const ROUTED = /^(?:conditions\.|actions\[\d+\]\.)/;

/** The editor works on a group: a rule saved with a lone condition shows it inside "All of these". */
const asGroup = (c: ConditionNode | null): ConditionGroup | null =>
  !c ? null : isGroup(c) ? c : { combinator: 'and', not: false, rules: [c] };

const FieldError: React.FunctionComponent<{ message?: string }> = ({ message }) =>
  message ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{message}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

const EditorForm: React.FunctionComponent<{
  existing?: Rule;
  options: AutomationOptions;
  canManage: boolean;
  /** A new rule was created: the page must not fetch it again for the URL it moves to. */
  onCreated(id: string): void;
  onReload(): void;
}> = ({ existing, options, canManage, onCreated, onReload }) => {
  const { token, workspace } = useSession();
  const t = token as string;
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  const start = existing ?? emptyRule();
  const [saved, setSaved] = React.useState<Rule | undefined>(existing);
  const [name, setName] = React.useState(start.name);
  const [description, setDescription] = React.useState(start.description ?? '');
  const [priority, setPriority] = React.useState(start.priority === null ? '' : String(start.priority));
  const [event, setEvent] = React.useState<EventKind>(start.event);
  const [conditions, setConditions] = React.useState<ConditionGroup | null>(() => asGroup(start.conditions));
  const [actions, setActions] = React.useState<AutomationAction[]>(start.actions);
  const [whenOpen, setWhenOpen] = React.useState(false);
  const [pendingEvent, setPendingEvent] = React.useState<EventKind | null>(null);
  const action = useAction(SHOWN);
  const move = useAction();

  const published = saved?.status === 'PUBLISHED';
  const readOnly = !canManage || published;
  const fieldErrors = action.fieldErrors;
  const split = conditionErrors(fieldErrors);
  const fieldKeys = Object.keys(fieldErrors);
  const banner =
    fieldKeys.length > 0
      ? fieldKeys
          .filter((k) => SHOWN.indexOf(k) < 0 && !ROUTED.test(k))
          .map((k) => `${k}: ${fieldErrors[k]}`)
          .join('; ') || null
      : action.error;

  /** An edit after a refused save or publish: the old messages point at what is no longer there. */
  const edited = () => {
    if (fieldKeys.length > 0) action.reset();
  };

  const applyEvent = (next: EventKind) => {
    setEvent(next);
    setConditions(null);
    setActions((current) => current.filter((a) => a.type !== 'ADD_TO_CRM'));
    edited();
  };
  const chooseEvent = (next: EventKind) => {
    if (next === event) return;
    const clears = (conditions !== null && conditions.rules.length > 0) || actions.some((a) => a.type === 'ADD_TO_CRM');
    if (clears) setPendingEvent(next);
    else applyEvent(next);
  };

  const request = (): RuleRequest => ({
    name: name.trim(),
    description: description.trim() === '' ? null : description.trim(),
    event,
    priority: priority.trim() === '' ? null : Number(priority),
    conditions: pruneConditions(conditions),
    actions,
  });

  /** Creates the rule (moving to its URL) or updates it; the form keeps what the user typed. */
  const persist = async (): Promise<Rule> => {
    const rule = saved
      ? await updateRule(t, ws, saved.id, { ...request(), version: saved.version })
      : await createRule(t, ws, request());
    setSaved(rule);
    if (!saved) {
      onCreated(rule.id);
      navigate(`/automations/${rule.id}`, { replace: true });
    }
    return rule;
  };

  /** Runs {@code fn}; a rule someone published meanwhile is fetched again, which shows it read-only. */
  const guarded = <T,>(fn: () => Promise<T>) =>
    action.run(async () => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError && e.code === 'AUTOMATION_RULE_PUBLISHED') onReload();
        throw e;
      }
    });

  const saveDraft = () => void guarded(persist);
  const publish = () =>
    void guarded(async () => {
      const rule = await persist();
      const done = await publishRule(t, ws, rule.id);
      setSaved(done);
      return done;
    });
  const test = () =>
    void guarded(async () => {
      const rule = await persist();
      navigate(`/automations/${rule.id}/test`);
      return rule;
    });
  const moveToDraft = () =>
    void move.run(async () => {
      if (!saved) return;
      setSaved(await unpublishRule(t, ws, saved.id));
    });

  const busy = action.busy || move.busy;
  const cannotSave = busy || name.trim() === '';
  const title = !existing && !saved ? 'New rule' : canManage ? 'Edit rule' : 'Rule';

  return (
    <PageShell
      title={title}
      actions={saved && <Label color={statusColor(saved.status)}>{statusLabel(saved.status)}</Label>}
    >
      <Form onSubmit={(e) => e.preventDefault()} style={{ maxWidth: '64rem' }}>
        {published && canManage && (
          <Alert
            variant="info"
            isInline
            title={PUBLISHED_TEXT}
            actionLinks={
              <AlertActionLink onClick={moveToDraft} isDisabled={busy}>
                Move to draft
              </AlertActionLink>
            }
          />
        )}
        {move.error && <Alert variant="danger" isInline title={move.error} />}
        {banner && <Alert variant="danger" isInline title={banner} />}
        <FormGroup label="Name" isRequired fieldId="automation-name">
          <TextInput
            id="automation-name"
            isRequired
            value={name}
            isDisabled={readOnly}
            validated={fieldErrors.name ? 'error' : 'default'}
            onChange={(_e, v) => setName(v)}
          />
          <FieldError message={fieldErrors.name} />
        </FormGroup>
        <FormGroup label="Description" fieldId="automation-description">
          <TextArea
            id="automation-description"
            value={description}
            isDisabled={readOnly}
            resizeOrientation="vertical"
            onChange={(_e, v) => setDescription(v)}
          />
          <FieldError message={fieldErrors.description} />
        </FormGroup>
        <FormGroup label="Priority" fieldId="automation-priority">
          <TextInput
            id="automation-priority"
            type="number"
            value={priority}
            isDisabled={readOnly}
            validated={fieldErrors.priority ? 'error' : 'default'}
            onChange={(_e, v) => setPriority(v)}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{PRIORITY_HELP}</HelperTextItem>
              {fieldErrors.priority && <HelperTextItem variant="error">{fieldErrors.priority}</HelperTextItem>}
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <Title headingLevel="h2" size="md" id="automation-when">
          When
        </Title>
        <div>
          <Select
            isOpen={whenOpen}
            selected={event}
            onOpenChange={setWhenOpen}
            onSelect={(_e, v) => {
              setWhenOpen(false);
              chooseEvent(v as EventKind);
            }}
            toggle={(ref) => (
              <MenuToggle
                ref={ref}
                id="automation-event"
                aria-labelledby="automation-when automation-event"
                isDisabled={readOnly}
                isExpanded={whenOpen}
                onClick={() => setWhenOpen((o) => !o)}
              >
                {eventLabel(event)}
              </MenuToggle>
            )}
          >
            <SelectList>
              {EVENTS.map((e) => (
                <SelectOption key={e.kind} value={e.kind} description={e.description}>
                  {e.label}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
          <FieldError message={fieldErrors.event} />
        </div>

        <Title headingLevel="h2" size="md">
          If
        </Title>
        <ConditionTreeEditor
          event={event}
          root={conditions}
          options={options}
          errors={split.byPath}
          isDisabled={readOnly}
          onChange={(next) => {
            setConditions(next);
            edited();
          }}
        />

        <Title headingLevel="h2" size="md">
          Then
        </Title>
        {fieldErrors.actions && (
          <HelperText>
            <HelperTextItem variant="error">{fieldErrors.actions}</HelperTextItem>
          </HelperText>
        )}
        <ActionList
          event={event}
          actions={actions}
          options={options}
          errors={split.byAction}
          isDisabled={readOnly}
          onChange={(next) => {
            setActions(next);
            edited();
          }}
        />

        {canManage && (
          <ActionGroup>
            {!published && (
              <>
                <Button variant="primary" isDisabled={cannotSave} isLoading={action.busy} onClick={saveDraft}>
                  Save draft
                </Button>
                <Button variant="secondary" isDisabled={cannotSave} onClick={publish}>
                  Publish
                </Button>
                <Button variant="secondary" isDisabled={cannotSave} onClick={test}>
                  Test
                </Button>
              </>
            )}
            <Button variant="link" onClick={() => navigate(LIST)}>
              Cancel
            </Button>
          </ActionGroup>
        )}
      </Form>
      {pendingEvent && (
        <ConfirmModal
          title="Change the event?"
          confirmLabel="Change event"
          onConfirm={() => {
            applyEvent(pendingEvent);
            setPendingEvent(null);
          }}
          onCancel={() => setPendingEvent(null)}
        >
          {CHANGE_EVENT_TEXT}
        </ConfirmModal>
      )}
    </PageShell>
  );
};

/** A new rule, or one rule to edit (read-only when published, or without automation:manage): When, If, Then. */
export const AutomationEditorPage: React.FunctionComponent = () => {
  const { id } = useParams();
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('automation:manage');
  const options = useAutomationOptions();
  // the rule this page created: its form is already on screen, so the URL it moved to is not fetched
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [generation, setGeneration] = React.useState(0);
  const fetchId = id !== undefined && id !== createdId ? id : undefined;
  const rule = useLoad((tk) => (fetchId ? getRule(tk, ws, fetchId) : Promise.resolve(undefined)), [ws, fetchId]);

  const error = options.error ?? rule.error;
  if (error || !options.data || (fetchId && !rule.data)) {
    return (
      <PageShell title={id ? 'Rule' : 'New rule'}>
        {error ? <Alert variant="danger" isInline title={error} /> : <Spinner aria-label="Loading rule" />}
      </PageShell>
    );
  }
  return (
    <EditorForm
      key={`${fetchId ?? 'local'}-${generation}`}
      existing={fetchId ? rule.data : undefined}
      options={options.data}
      canManage={canManage}
      onCreated={setCreatedId}
      onReload={() => {
        // forget the stale copy first, so the form remounts from the fetched one
        setCreatedId(null);
        rule.setData(() => undefined);
        rule.reload();
        setGeneration((g) => g + 1);
      }}
    />
  );
};
