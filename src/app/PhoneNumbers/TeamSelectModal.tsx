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
} from '@patternfly/react-core';
import { PhoneNumber, setNumberTeam, shown } from '@app/api/phoneNumbers';
import { listTeams } from '@app/api/teams';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

/** Which team works a number (design §3.1): only its members and brand admins see the number in the inbox. */
export const TeamSelectModal: React.FunctionComponent<{
  workspaceId: string;
  number: PhoneNumber;
  onSaved(number: PhoneNumber): void;
  onCancel(): void;
}> = ({ workspaceId, number, onSaved, onCancel }) => {
  const { token } = useSession();
  const teams = useLoad((t) => listTeams(t, workspaceId), [workspaceId]);
  const [teamId, setTeamId] = React.useState(number.team?.id ?? '');
  const action = useAction(['teamId']);
  const error = teams.error ?? action.error;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const saved = await action.run(() => setNumberTeam(token as string, workspaceId, number.id, teamId || null));
    if (saved) onSaved(saved);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="team-select-title">
      <ModalHeader title={`Team for ${shown(number.number)}`} labelId="team-select-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        {!teams.data ? (
          !teams.error && <Spinner aria-label="Loading teams" />
        ) : (
          <Form id="team-select-form" onSubmit={onSubmit}>
            <FormGroup label="Team" fieldId="number-team">
              <FormSelect id="number-team" value={teamId} onChange={(_e, v) => setTeamId(v)}>
                <FormSelectOption value="" label="No team" />
                {teams.data.map((t) => (
                  <FormSelectOption key={t.id} value={t.id} label={t.name} />
                ))}
              </FormSelect>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>Only this team&apos;s members and brand admins see the number in the inbox.</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="team-select-form" variant="primary" isDisabled={!teams.data || action.busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
