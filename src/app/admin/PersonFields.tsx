import * as React from 'react';
import {
  Button,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  TextInput,
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';
import { MIN_PASSWORD_LENGTH } from '@app/Login/NewPasswordPage';

export interface Person {
  name: string;
  username: string;
  email: string;
  mobileNumber: string;
  temporaryPassword: string;
}

export const EMPTY_PERSON: Person = { name: '', username: '', email: '', mobileNumber: '', temporaryPassword: '' };

export type PersonMode = 'create' | 'edit';

/** Client-side checks; the server checks again. */
export function validatePerson(p: Person, mode: PersonMode): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!p.name.trim()) errors.name = 'Required.';
  if (mode === 'create') {
    if (!p.username.trim()) errors.username = 'Required.';
    if (p.temporaryPassword.length < MIN_PASSWORD_LENGTH) {
      errors.temporaryPassword = `At least ${MIN_PASSWORD_LENGTH} characters.`;
    }
  }
  return errors;
}

const Helper: React.FunctionComponent<{ error?: string; hint?: string }> = ({ error, hint }) =>
  error || hint ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant={error ? 'error' : 'default'}>{error ?? hint}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

/** Name, username, email, mobile and (on create) a temporary password, for any "person" form. */
export const PersonFields: React.FunctionComponent<{
  mode: PersonMode;
  values: Person;
  onChange(values: Person): void;
  errors: Record<string, string>;
  idPrefix?: string;
}> = ({ mode, values, onChange, errors, idPrefix = 'person' }) => {
  const [shown, setShown] = React.useState(false);
  const set = (key: keyof Person) => (_e: unknown, v: string) => onChange({ ...values, [key]: v });
  const text = (key: keyof Person, label: string, required: boolean, type: 'text' | 'email' | 'tel' = 'text') => (
    <FormGroup label={label} fieldId={`${idPrefix}-${key}`} isRequired={required}>
      <TextInput
        id={`${idPrefix}-${key}`}
        type={type}
        value={values[key]}
        onChange={set(key)}
        validated={errors[key] ? 'error' : 'default'}
        isRequired={required}
      />
      <Helper error={errors[key]} />
    </FormGroup>
  );
  return (
    <>
      {text('name', 'Name', true)}
      {mode === 'create' && text('username', 'Username', true)}
      {text('email', 'Email', false, 'email')}
      {text('mobileNumber', 'Mobile', false, 'tel')}
      {mode === 'create' && (
        <FormGroup label="Temporary password" fieldId={`${idPrefix}-temporaryPassword`} isRequired>
          <InputGroup>
            <InputGroupItem isFill>
              <TextInput
                id={`${idPrefix}-temporaryPassword`}
                type={shown ? 'text' : 'password'}
                value={values.temporaryPassword}
                onChange={set('temporaryPassword')}
                autoComplete="new-password"
                validated={errors.temporaryPassword ? 'error' : 'default'}
                isRequired
              />
            </InputGroupItem>
            <InputGroupItem>
              <Button
                variant="control"
                aria-label={shown ? 'Hide temporary password' : 'Show temporary password'}
                onClick={() => setShown(!shown)}
                icon={shown ? <EyeSlashIcon /> : <EyeIcon />}
              />
            </InputGroupItem>
          </InputGroup>
          <Helper
            error={errors.temporaryPassword}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters. They must change it when they first log in.`}
          />
        </FormGroup>
      )}
    </>
  );
};
