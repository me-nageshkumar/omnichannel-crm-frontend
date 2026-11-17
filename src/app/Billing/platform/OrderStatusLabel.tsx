import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { OrderStatus } from '@app/api/billing';
import { STATUS_LABEL } from '@app/Billing/common/orderText';

const COLOR: Record<OrderStatus, 'blue' | 'green' | 'grey' | 'red' | 'orange'> = {
  REQUESTED: 'blue',
  ACTIVATING: 'orange',
  ACTIVATED: 'green',
  CANCELLED: 'grey',
  REJECTED: 'red',
  EXPIRED: 'grey',
  SUPERSEDED: 'grey',
};

/** What became of an order, in words and a colour. */
export const OrderStatusLabel: React.FunctionComponent<{ status: OrderStatus }> = ({ status }) => (
  <Label color={COLOR[status]} isCompact>
    {STATUS_LABEL[status]}
  </Label>
);
