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
  TextInput,
} from '@patternfly/react-core';
import {
  Authority,
  NeedsCreating,
  createAuthority,
  groupOf,
  updateAuthority,
  validateAuthority,
} from '@app/api/authorities';
import { LEVEL_LABELS, ROLE_LEVELS, RoleLevel } from '@app/api/roles';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { Typeahead } from '@app/Authorities/Typeahead';
import { wrongLevelText } from '@app/Authorities/AuthorityStatusLabel';

const FIELDS = ['code', 'group', 'level', 'description'];

/**
 * Whether {@code level} can pass the check code makes, judged from the scan's suggestion: a code
 * checked only per brand suggests BRAND, which PLATFORM can never pass; any other check is a global
 * one, which BRAND can never pass. COMPANY fits both.
 */
function wrongLevel(found: NeedsCreating, level: RoleLevel): boolean {
  if (level === 'COMPANY') return false;
  return found.suggestedLevel === 'BRAND' ? level === 'PLATFORM' : level === 'BRAND';
}

const Field: React.FunctionComponent<{
  error?: string;
  warning?: string;
  helper?: string;
  children: React.ReactNode;
  label: string;
  fieldId: string;
  isRequired?: boolean;
}> = ({ error, warning, helper, children, label, fieldId, isRequired }) => (
  <FormGroup label={label} fieldId={fieldId} isRequired={isRequired}>
    {children}
    {(error || warning || helper) && (
      <FormHelperText>
        <HelperText>
          {error && <HelperTextItem variant="error">{error}</HelperTextItem>}
          {!error && warning && <HelperTextItem variant="warning">{warning}</HelperTextItem>}
          {!error && !warning && helper && <HelperTextItem>{helper}</HelperTextItem>}
        </HelperText>
      </FormHelperText>
    )}
  </FormGroup>
);

/** Create an authority (optionally from a code found in code) or edit one's group, level and description. */
export const AuthorityModal: React.FunctionComponent<{
  mode: 'create' | 'edit';
  authority?: Authority;
  prefill?: NeedsCreating;
  /** Undefined until loaded (or if loading failed): no "nothing checks it" warning is shown then. */
  needsCreating: NeedsCreating[] | undefined;
  existingCodes: string[];
  groups: string[];
  onSaved(a: Authority): void;
  onCancel(): void;
}> = ({ mode, authority, prefill, needsCreating, existingCodes, groups, onSaved, onCancel }) => {
  const { token } = useSession();
  const editing = mode === 'edit' && authority !== undefined;
  const [code, setCode] = React.useState(authority?.code ?? prefill?.code ?? '');
  const [group, setGroup] = React.useState(authority?.group ?? prefill?.suggestedGroup ?? '');
  // The group follows the code until the user edits the group field itself; a pick or prefill doesn't count.
  const [groupTouched, setGroupTouched] = React.useState(editing);
  const [level, setLevel] = React.useState<RoleLevel | ''>(authority?.level ?? prefill?.suggestedLevel ?? '');
  const [description, setDescription] = React.useState(authority?.description ?? '');
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);
  const errors = { ...action.fieldErrors, ...clientErrors };

  const found = needsCreating?.find((n) => n.code === code.trim());
  const exists = !editing && existingCodes.includes(code.trim());
  const levelLocked = editing && (authority.builtIn || authority.roles.length > 0);
  const levelHelper = !editing
    ? undefined
    : authority.builtIn
      ? 'Built-in authorities keep their level.'
      : authority.roles.length > 0
        ? `In a role (${authority.roles.join(', ')}). Remove it from roles to change its level.`
        : undefined;

  const codeWarning = exists
    ? 'An authority with this code already exists.'
    : !editing && code.trim() && needsCreating && !found
      ? `No code checks ${code.trim()} yet. It will have no effect until it does.`
      : undefined;
  const levelWarning = !editing && found && level && wrongLevel(found, level) ? wrongLevelText(level) : undefined;

  const onCodeChange = (value: string) => {
    setCode(value);
    if (!groupTouched) setGroup(groupOf(value.trim()));
  };

  const onPick = (value: string) => {
    const pick = needsCreating?.find((n) => n.code === value);
    setCode(value);
    if (!pick) return;
    if (!groupTouched) setGroup(pick.suggestedGroup);
    if (pick.suggestedLevel) setLevel(pick.suggestedLevel);
  };

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const input = { group: group.trim(), level: level as RoleLevel, description: description.trim() };
    const problems = validateAuthority(editing ? input : { code: code.trim(), ...input });
    if (!level) problems.level = 'Choose a level.';
    setClientErrors(problems);
    if (Object.keys(problems).length > 0) return;
    const saved = await action.run(() =>
      editing
        ? updateAuthority(token as string, authority.code, input)
        : createAuthority(token as string, { code: code.trim(), ...input }),
    );
    if (saved) onSaved(saved);
  };

  const title = editing ? `Edit ${authority.code}` : 'Add authority';
  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="authority-modal-title">
      <ModalHeader title={title} labelId="authority-modal-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="authority-form" onSubmit={onSubmit}>
          <Field label="Code" fieldId="authority-code" isRequired error={errors.code} warning={codeWarning}>
            {editing ? (
              <TextInput id="authority-code" value={authority.code} readOnlyVariant="default" />
            ) : (
              <Typeahead
                id="authority-code"
                label="Code"
                value={code}
                options={(needsCreating ?? []).map((n) => ({ value: n.code, description: n.checkedIn.join(', ') }))}
                onChange={onCodeChange}
                onPick={onPick}
              />
            )}
          </Field>
          <Field label="Group" fieldId="authority-group" isRequired error={errors.group}>
            <Typeahead
              id="authority-group"
              label="Group"
              value={group}
              options={groups.map((g) => ({ value: g }))}
              onChange={(v) => {
                setGroup(v);
                setGroupTouched(true);
              }}
              onPick={(v) => {
                setGroup(v);
                setGroupTouched(true);
              }}
            />
          </Field>
          <Field
            label="Level"
            fieldId="authority-level"
            isRequired
            error={errors.level}
            warning={levelWarning}
            helper={levelHelper}
          >
            <FormSelect
              id="authority-level"
              value={level}
              isDisabled={levelLocked}
              onChange={(_e, v) => setLevel(v as RoleLevel | '')}
            >
              <FormSelectOption value="" label="Select a level" isPlaceholder />
              {ROLE_LEVELS.map((l) => (
                <FormSelectOption key={l} value={l} label={LEVEL_LABELS[l]} />
              ))}
            </FormSelect>
          </Field>
          <Field label="Description" fieldId="authority-description" isRequired error={errors.description}>
            <TextInput
              id="authority-description"
              value={description}
              onChange={(_e, v) => setDescription(v)}
              validated={errors.description ? 'error' : 'default'}
            />
          </Field>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="authority-form" isDisabled={action.busy}>
          {editing ? 'Save' : 'Create'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
