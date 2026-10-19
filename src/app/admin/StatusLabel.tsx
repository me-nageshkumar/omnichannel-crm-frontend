import * as React from 'react';
import { Label } from '@patternfly/react-core';

export const StatusLabel: React.FunctionComponent<{ active: boolean }> = ({ active }) =>
  active ? <Label color="green">Active</Label> : <Label color="grey">Inactive</Label>;
