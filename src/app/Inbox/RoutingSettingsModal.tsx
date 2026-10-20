import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Switch,
} from '@patternfly/react-core';
import { InboxSettings, RoutingMode, getInboxSettings, putInboxSettings } from '@app/api/inbox';
import { listTeams } from '@app/api/teams';
import { listWorkspaceUsers } from '@app/api/workspaceUsers';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

const MODES: Array<{ value: RoutingMode; label: string }> = [
  { value: 'NONE', label: 'Leave unassigned' },
  { value: 'TEAM', label: 'Team queue' },
  { value: 'USER', label: 'One agent' },
  { value: 'ROUND_ROBIN', label: 'Round robin in team' },
];

const FieldError: React.FunctionComponent<{ error?: string }> = ({ error }) =>
  error ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{error}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

/** How new chats of one number are routed, and what happens to the assignment on reply and close. */
export const RoutingSettingsModal: React.FunctionComponent<{ phoneNumberId: string; onClose(): void }> = ({
  phoneNumberId,
  onClose,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const settings = useLoad((tk) => getInboxSettings(tk, ws, phoneNumberId), [ws, phoneNumberId]);
  const teams = useLoad((tk) => listTeams(tk, ws), [ws]);
  const users = useLoad((tk) => listWorkspaceUsers(tk, ws), [ws]);
  const [draft, setDraft] = React.useState<InboxSettings | null>(null);
  const action = useAction(['teamId', 'userId']);

  const form = draft ?? settings.data;
  const change = (patch: Partial<InboxSettings>) => form && setDraft({ ...form, ...patch });
  const needsTeam = form?.mode === 'TEAM' || form?.mode === 'ROUND_ROBIN';
  const needsUser = form?.mode === 'USER';
  const loadError = settings.error ?? teams.error ?? users.error;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!form) return;
    const body: InboxSettings = {
      ...form,
      teamId: needsTeam ? form.teamId : null,
      userId: needsUser ? form.userId : null,
    };
    const saved = await action.run(() => putInboxSettings(t, ws, phoneNumberId, body));
    if (saved !== undefined) onClose();
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="routing-title">
      <ModalHeader title="Routing" labelId="routing-title" />
      <ModalBody>
        {loadError && <Alert variant="danger" isInline isPlain title={loadError} />}
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        {!form ? (
          !loadError && <Spinner aria-label="Loading routing settings" />
        ) : (
          <Form id="routing-form" onSubmit={onSubmit}>
            <FormGroup label="Routing" fieldId="routing-mode">
              <FormSelect
                id="routing-mode"
                value={form.mode}
                onChange={(_e, v) => change({ mode: v as RoutingMode })}
              >
                {MODES.map((m) => (
                  <FormSelectOption key={m.value} value={m.value} label={m.label} />
                ))}
              </FormSelect>
            </FormGroup>
            {needsTeam && (
              <FormGroup label="Team" fieldId="routing-team" isRequired>
                <FormSelect
                  id="routing-team"
                  value={form.teamId ?? ''}
                  onChange={(_e, v) => change({ teamId: v || null })}
                  validated={action.fieldErrors.teamId ? 'error' : 'default'}
                >
                  <FormSelectOption value="" label="Select a team" isPlaceholder isDisabled />
                  {(teams.data ?? []).map((tm) => (
                    <FormSelectOption key={tm.id} value={tm.id} label={tm.name} />
                  ))}
                </FormSelect>
                <FieldError error={action.fieldErrors.teamId} />
              </FormGroup>
            )}
            {needsUser && (
              <FormGroup label="Agent" fieldId="routing-agent" isRequired>
                <FormSelect
                  id="routing-agent"
                  value={form.userId ?? ''}
                  onChange={(_e, v) => change({ userId: v || null })}
                  validated={action.fieldErrors.userId ? 'error' : 'default'}
                >
                  <FormSelectOption value="" label="Select an agent" isPlaceholder isDisabled />
                  {(users.data ?? []).map((u) => (
                    <FormSelectOption key={u.id} value={u.id} label={u.name} />
                  ))}
                </FormSelect>
                <FieldError error={action.fieldErrors.userId} />
              </FormGroup>
            )}
            <Switch
              id="routing-claim"
              label="Assign the chat to whoever replies first"
              isChecked={form.claimOnReply}
              onChange={(_e, v) => change({ claimOnReply: v })}
            />
            <Switch
              id="routing-keep"
              label="Keep the assignment when a chat is closed"
              isChecked={form.keepAssignmentOnClose}
              onChange={(_e, v) => change({ keepAssignmentOnClose: v })}
            />
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="routing-form" isDisabled={action.busy || !form}>
          Save
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
