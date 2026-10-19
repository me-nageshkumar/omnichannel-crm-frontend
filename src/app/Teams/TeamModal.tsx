import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { Team, updateTeam } from '@app/api/teams';
import type { WorkspaceUser } from '@app/api/workspaceUsers';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';

/** Rename a team and choose its members from the people with access to the brand. */
export const TeamModal: React.FunctionComponent<{
  workspaceId: string;
  team: Team;
  people: WorkspaceUser[];
  onSaved(team: Team): void;
  onCancel(): void;
}> = ({ workspaceId, team, people, onSaved, onCancel }) => {
  const { token } = useSession();
  const [name, setName] = React.useState(team.name);
  const [memberIds, setMemberIds] = React.useState<string[]>(team.members.map((m) => m.id));
  const action = useAction();
  const error = action.fieldErrors.name;

  const toggle = (id: string, on: boolean) =>
    setMemberIds((ids) => (on ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id)));

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!name.trim()) return;
    const saved = await action.run(() => updateTeam(token as string, workspaceId, team.id, name.trim(), memberIds));
    if (saved) onSaved(saved);
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="team-title">
      <ModalHeader title={`Edit ${team.name}`} labelId="team-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="team-form" onSubmit={onSubmit}>
          <FormGroup label="Name" fieldId="team-name" isRequired>
            <TextInput
              id="team-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={error ? 'error' : 'default'}
              isRequired
            />
          </FormGroup>
          <FormGroup role="group" label="Members" fieldId="team-members" isStack aria-label="Members">
            {people.map((p) => (
              <Checkbox
                key={p.id}
                id={`team-member-${p.id}`}
                label={`${p.name} (${p.username})`}
                isChecked={memberIds.includes(p.id)}
                onChange={(_e, on) => toggle(p.id, on)}
              />
            ))}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="team-form" isDisabled={action.busy || !name.trim()}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
