import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Content,
  Form,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  SearchInput,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import {
  Authority,
  LEVEL_LABELS,
  ROLE_LEVELS,
  Role,
  RoleChangePreview,
  RoleLevel,
  createRole,
  levelsHeldBy,
  previewRole,
  updateRole,
} from '@app/api/roles';
import { roleLabel } from '@app/api/users';
import { matchesSearch } from '@app/api/authorities';
import { AuthorityStatusLabel } from '@app/Authorities/AuthorityStatusLabel';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';

const NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;

function describeChange(c: RoleChangePreview): string {
  const assigner = roleLabel(c.assigner);
  const assigned = roleLabel(c.assigned);
  return c.nowAssignable
    ? `${assigner} will now be able to assign ${assigned}.`
    : `${assigner} will no longer be able to assign ${assigned}.`;
}

/** Create a role, or edit one; an edit first previews who gains or loses the power to assign what. */
export const RoleEditor: React.FunctionComponent<{
  role: Role | null;
  /** Undefined until the catalogue loads; saving is disabled until then so no authority is dropped. */
  authorities: Authority[] | undefined;
  onSaved(role: Role): void;
  onCancel(): void;
}> = ({ role, authorities, onSaved, onCancel }) => {
  const { token } = useSession();
  const [name, setName] = React.useState(role?.name ?? '');
  const [description, setDescription] = React.useState(role?.description ?? '');
  const [level, setLevel] = React.useState<RoleLevel | ''>(role?.level ?? '');
  const [selected, setSelected] = React.useState<string[]>(role?.authorities ?? []);
  const [nameError, setNameError] = React.useState<string | undefined>(undefined);
  const [changes, setChanges] = React.useState<RoleChangePreview[] | null>(null);
  const action = useAction(['name']);

  const held = level ? levelsHeldBy(level) : [];
  const offered = (authorities ?? []).filter((a) => held.includes(a.level));
  const chosen = selected.filter((code) => offered.some((a) => a.code === code));
  const [search, setSearch] = React.useState('');
  // A group whose name matches shows all its authorities; otherwise only the matching ones.
  const groups = Array.from(new Set(offered.map((a) => a.group)))
    .sort()
    .map((group) => {
      const all = offered.filter((a) => a.group === group).sort((a, b) => a.code.localeCompare(b.code));
      const q = search.trim().toLowerCase();
      const shown = !q || group.toLowerCase().includes(q) ? all : all.filter((a) => matchesSearch(a, search));
      return { group, all, shown };
    })
    .filter((g) => g.shown.length > 0);

  const toggle = (code: string, on: boolean) =>
    setSelected((s) => (on ? [...s.filter((c) => c !== code), code] : s.filter((c) => c !== code)));

  const save = async () => {
    const body = { name, description, authorities: chosen };
    const saved = await action.run(() =>
      role
        ? updateRole(token as string, role.id, body)
        : createRole(token as string, { ...body, level: level as RoleLevel }),
    );
    if (saved) onSaved(saved);
    // back to the form, where the error is shown next to (or above) what caused it
    else setChanges(null);
  };

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!NAME_PATTERN.test(name)) {
      setNameError('Use capitals, digits and underscores, starting with a letter (e.g. SENIOR_AGENT).');
      return;
    }
    setNameError(undefined);
    if (!level) return;
    if (!role) {
      await save();
      return;
    }
    const preview = await action.run(() => previewRole(token as string, role.id, chosen));
    if (!preview) return;
    if (preview.changes.length > 0) setChanges(preview.changes);
    else await save();
  };

  if (changes) {
    return (
      <Modal isOpen variant="small" onClose={() => setChanges(null)} aria-labelledby="role-warning-title">
        <ModalHeader title="Save this change?" labelId="role-warning-title" titleIconVariant="warning" />
        <ModalBody>
          {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
          <List>
            {changes.map((c) => (
              <ListItem key={`${c.assigner}-${c.assigned}`}>{describeChange(c)}</ListItem>
            ))}
          </List>
        </ModalBody>
        <ModalFooter>
          <Button variant="warning" onClick={save} isDisabled={action.busy}>
            Save anyway
          </Button>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  const fieldErrors = { ...action.fieldErrors, ...(nameError ? { name: nameError } : {}) };
  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="role-editor-title">
      <ModalHeader title={role ? `Edit ${roleLabel(role.name)}` : 'Add role'} labelId="role-editor-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="role-form" onSubmit={onSubmit}>
          <FormGroup label="Name" fieldId="role-name" isRequired>
            <TextInput
              id="role-name"
              value={name}
              onChange={(_e, v) => setName(v.toUpperCase())}
              isDisabled={role?.builtIn ?? false}
              validated={fieldErrors.name ? 'error' : 'default'}
              isRequired
            />
            {fieldErrors.name && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{fieldErrors.name}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <FormGroup label="Level" fieldId="role-level" isRequired>
            <FormSelect
              id="role-level"
              value={level}
              onChange={(_e, v) => setLevel(v as RoleLevel)}
              isDisabled={role !== null}
              isRequired
            >
              <FormSelectOption value="" label="Select a level" isPlaceholder isDisabled />
              {ROLE_LEVELS.map((l) => (
                <FormSelectOption key={l} value={l} label={LEVEL_LABELS[l]} />
              ))}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Description" fieldId="role-description">
            <TextArea
              id="role-description"
              value={description}
              maxLength={500}
              onChange={(_e, v) => setDescription(v)}
            />
          </FormGroup>
          {offered.length > 0 && (
            <SearchInput
              aria-label="Search authorities"
              placeholder="Search by code, group or description"
              value={search}
              onChange={(_e, v) => setSearch(v)}
              onClear={() => setSearch('')}
            />
          )}
          {groups.map(({ group, all, shown }) => (
            <section key={group} aria-label={group}>
              <FormFieldGroup
                header={
                  <FormFieldGroupHeader
                    titleText={{ text: group, id: `auth-group-${group}` }}
                    titleDescription={`${all.filter((a) => chosen.includes(a.code)).length} of ${all.length} selected`}
                  />
                }
              >
                {shown.map((a) => (
                  <Checkbox
                    key={a.code}
                    id={`auth-${a.code}`}
                    label={
                      <>
                        {a.description} <AuthorityStatusLabel authority={a} />
                      </>
                    }
                    description={<Content component="small">{a.code}</Content>}
                    isChecked={chosen.includes(a.code)}
                    onChange={(_e, on) => toggle(a.code, on)}
                  />
                ))}
              </FormFieldGroup>
            </section>
          ))}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="role-form" isDisabled={action.busy || !level || !authorities}>
          {role ? 'Save' : 'Create'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
