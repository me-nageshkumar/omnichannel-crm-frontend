import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { ContactLabel } from '@app/api/contacts';

/** A contact label in its own colour. */
export const LabelChip: React.FunctionComponent<{ label: ContactLabel; onClose?: () => void }> = ({
  label,
  onClose,
}) => (
  <Label color={label.color} isCompact onClose={onClose} closeBtnAriaLabel={`Remove ${label.name}`}>
    {label.name}
  </Label>
);
