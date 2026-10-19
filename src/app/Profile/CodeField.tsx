import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem, TextInput } from '@patternfly/react-core';

/** The 6-digit authenticator code input used by enable and disable. */
export const CodeField: React.FunctionComponent<{
  id: string;
  value: string;
  onChange(value: string): void;
  error: string | null;
}> = ({ id, value, onChange, error }) => (
  <FormGroup label="6-digit code" fieldId={id} isRequired>
    <TextInput
      id={id}
      value={value}
      onChange={(_e, v) => onChange(v)}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      validated={error ? 'error' : 'default'}
      isRequired
    />
    {error && (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="error">{error}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    )}
  </FormGroup>
);
