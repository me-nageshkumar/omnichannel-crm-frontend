import * as React from 'react';
import {
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { RoleRef, roleLabel } from '@app/api/users';

/** A role picker over the roles the server says the caller may give. */
export const RoleSelect: React.FunctionComponent<{
  id: string;
  roles: RoleRef[];
  value: string;
  onChange(roleId: string): void;
  error?: string;
  label?: string;
}> = ({ id, roles, value, onChange, error, label = 'Role' }) => (
  <FormGroup label={label} fieldId={id} isRequired>
    <FormSelect
      id={id}
      value={value}
      onChange={(_e, v) => onChange(v)}
      validated={error ? 'error' : 'default'}
      isRequired
    >
      <FormSelectOption value="" label="Select a role" isPlaceholder isDisabled />
      {roles.map((r) => (
        <FormSelectOption key={r.id} value={r.id} label={roleLabel(r.name)} />
      ))}
    </FormSelect>
    {error && (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="error">{error}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    )}
  </FormGroup>
);
