import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem } from '@patternfly/react-core';

/** A form group with an optional error line under the control. */
export const Field: React.FunctionComponent<{
  label: string;
  fieldId: string;
  isRequired?: boolean;
  error?: string | null;
  help?: string;
  children: React.ReactNode;
}> = ({ label, fieldId, isRequired, error, help, children }) => (
  <FormGroup label={label} fieldId={fieldId} isRequired={isRequired}>
    {children}
    {(error || help) && (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={error ? 'error' : 'default'}>{error || help}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    )}
  </FormGroup>
);
