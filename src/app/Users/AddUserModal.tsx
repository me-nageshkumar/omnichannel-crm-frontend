import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tab,
  TabTitleText,
  Tabs,
} from '@patternfly/react-core';
import type { RoleRef } from '@app/api/users';
import {
  Added,
  WorkspaceUser,
  addExistingUser,
  createWorkspaceUser,
  listWorkspaceUsers,
} from '@app/api/workspaceUsers';
import { EMPTY_PERSON, Person, PersonFields, validatePerson } from '@app/admin/PersonFields';
import { RoleSelect } from '@app/admin/RoleSelect';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';

/**
 * Company users from the caller's other brands who have no role here yet. Customer Admins ("all brands")
 * already have access everywhere, so they are left out.
 */
function useCandidates(workspaceId: string, present: WorkspaceUser[]): WorkspaceUser[] {
  const { token, user } = useSession();
  const [others, setOthers] = React.useState<WorkspaceUser[]>([]);
  const otherIds = (user?.workspaces ?? []).filter((w) => w.id !== workspaceId && w.authorities.includes('user:view'));
  const key = otherIds.map((w) => w.id).join(',');

  React.useEffect(() => {
    if (!token || !key) return undefined;
    let live = true;
    Promise.all(key.split(',').map((id) => listWorkspaceUsers(token, id).catch(() => [] as WorkspaceUser[]))).then(
      (lists) => {
        if (live) setOthers(lists.flat());
      },
    );
    return () => {
      live = false;
    };
  }, [token, key]);

  const here = new Set(present.map((u) => u.id));
  const seen = new Set<string>();
  return others
    .filter((u) => !u.allBrands && !here.has(u.id) && !seen.has(u.id) && seen.add(u.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Add a person to this brand: a new login, or someone already in another of the company's brands. */
export const AddUserModal: React.FunctionComponent<{
  workspaceId: string;
  present: WorkspaceUser[];
  roles: RoleRef[];
  onAdded(added: Added): void;
  onCancel(): void;
}> = ({ workspaceId, present, roles, onAdded, onCancel }) => {
  const { token } = useSession();
  const [tab, setTab] = React.useState<'new' | 'existing'>('new');
  const [person, setPerson] = React.useState<Person>(EMPTY_PERSON);
  const [userId, setUserId] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const candidates = useCandidates(workspaceId, present);
  const action = useAction(['name', 'username', 'email', 'mobileNumber', 'temporaryPassword', 'roleId']);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const local = tab === 'new' ? validatePerson(person, 'create') : {};
    if (tab === 'existing' && !userId) local.userId = 'Required.';
    if (!roleId) local.roleId = 'Required.';
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    const t = token as string;
    const added = await action.run(() =>
      tab === 'new'
        ? createWorkspaceUser(t, workspaceId, { ...person, roleId })
        : addExistingUser(t, workspaceId, userId, roleId),
    );
    if (added) onAdded(added);
  };

  const shown = { ...errors, ...action.fieldErrors };
  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="add-user-title">
      <ModalHeader title="Add user" labelId="add-user-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as 'new' | 'existing')} aria-label="Who to add">
          <Tab eventKey="new" title={<TabTitleText>New person</TabTitleText>} />
          <Tab eventKey="existing" title={<TabTitleText>Existing person</TabTitleText>} />
        </Tabs>
        <Form id="add-user-form" onSubmit={onSubmit} style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
          {tab === 'new' ? (
            <PersonFields mode="create" values={person} onChange={setPerson} errors={shown} />
          ) : (
            <FormGroup label="Person" fieldId="add-user-person" isRequired>
              <FormSelect id="add-user-person" value={userId} onChange={(_e, v) => setUserId(v)} isRequired>
                <FormSelectOption
                  value=""
                  label={candidates.length ? 'Select a person' : 'No one else to add'}
                  isPlaceholder
                  isDisabled
                />
                {candidates.map((u) => (
                  <FormSelectOption key={u.id} value={u.id} label={`${u.name} (${u.username})`} />
                ))}
              </FormSelect>
            </FormGroup>
          )}
          <RoleSelect id="add-user-role" roles={roles} value={roleId} onChange={setRoleId} error={shown.roleId} />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="add-user-form" isDisabled={action.busy}>
          Add
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
