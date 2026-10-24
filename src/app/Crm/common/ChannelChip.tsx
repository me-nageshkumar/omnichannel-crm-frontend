import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { PhoneIcon } from '@patternfly/react-icons';

/** A compact chip naming the phone number a record talks through: its label, else the number. */
export const ChannelChip: React.FunctionComponent<{ number: string; label?: string | null }> = ({ number, label }) => (
  <Label isCompact icon={<PhoneIcon />} title={label ? `${label} (${number})` : number}>
    {label || number}
  </Label>
);
