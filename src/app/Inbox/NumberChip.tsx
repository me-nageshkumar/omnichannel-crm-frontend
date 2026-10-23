import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { PhoneNumber, shown } from '@app/api/phoneNumbers';

/** Which of the viewer's numbers a chat is on; shown only when they look at more than one. */
export const NumberChip: React.FunctionComponent<{ number: PhoneNumber | undefined }> = ({ number }) =>
  number ? (
    <Label isCompact color="teal" title={number.label ?? undefined}>
      {shown(number.number)}
    </Label>
  ) : null;
