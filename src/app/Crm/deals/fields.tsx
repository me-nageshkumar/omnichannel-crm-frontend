import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem } from '@patternfly/react-core';

/**
 * A form group with an optional error line under the control. {@code role} is for a set of controls (no single element
 * to point the label at): the group then takes its name from the label.
 */
export const Field: React.FunctionComponent<{
  /** Omit it when the control's own text and the row around it say what it is. */
  label?: string;
  fieldId: string;
  role?: 'group' | 'radiogroup';
  isRequired?: boolean;
  error?: string | null;
  help?: string;
  children: React.ReactNode;
}> = ({ label, fieldId, role, isRequired, error, help, children }) => (
  <FormGroup label={label} fieldId={fieldId} role={role} isRequired={isRequired}>
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
