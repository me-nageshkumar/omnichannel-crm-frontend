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

const SET_AT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A write-only secret (spec 2026-11-15 §5.7). With a stored secret it shows only the hint and a "Replace" link; the
 * input appears when the person chooses to replace it. Without one, the input shows directly. What is typed is sent
 * once and never shown again.
 */
export const SecretField: React.FunctionComponent<{
  id: string;
  label: string;
  /** The stored secret's hint, e.g. "sk-…a91F"; null when nothing is stored. */
  hint: string | null;
  setAt: string | null;
  value: string;
  onChange(value: string): void;
  isRequired?: boolean;
  isDisabled?: boolean;
  error?: string;
  replaceLabel?: string;
}> = ({ id, label, hint, setAt, value, onChange, isRequired, isDisabled, error, replaceLabel = 'Replace key' }) => {
  const [replacing, setReplacing] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const editing = hint == null || replacing;
  return (
    <FormGroup label={label} fieldId={id} isRequired={isRequired && hint == null}>
      {!editing && (
        <div className="omni-form-field__row">
          <span>
            <code>{hint}</code>
            {setAt && ` · set ${SET_AT.format(new Date(setAt))}`}
          </span>{' '}
          {!isDisabled && (
            <Button variant="link" isInline onClick={() => setReplacing(true)}>
              {replaceLabel}
            </Button>
          )}
        </div>
      )}
      {editing && (
        <InputGroup>
          <InputGroupItem isFill>
            <TextInput
              id={id}
              type={shown ? 'text' : 'password'}
              autoComplete="new-password"
              value={value}
              isDisabled={isDisabled}
              validated={error ? 'error' : 'default'}
              onChange={(_e, v) => onChange(v)}
            />
          </InputGroupItem>
          <InputGroupItem>
            <Button
              variant="control"
              aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
              onClick={() => setShown(!shown)}
              icon={shown ? <EyeSlashIcon /> : <EyeIcon />}
            />
          </InputGroupItem>
        </InputGroup>
      )}
      {error && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
};
