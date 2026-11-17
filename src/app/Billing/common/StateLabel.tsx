import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { SubscriptionState } from '@app/api/billing';

const TEXT: Record<SubscriptionState, string> = {
  NONE: 'No plan',
  ACTIVE: 'Active',
  GRACE: 'Grace',
  EXPIRED: 'Read-only',
};
const COLOR: Record<SubscriptionState, 'grey' | 'green' | 'orange' | 'red'> = {
  NONE: 'grey',
  ACTIVE: 'green',
  GRACE: 'orange',
  EXPIRED: 'red',
};

/** Where a customer stands with its plan. */
export const StateLabel: React.FunctionComponent<{ state: SubscriptionState }> = ({ state }) => (
  <Label isCompact color={COLOR[state]}>
    {TEXT[state]}
  </Label>
);
