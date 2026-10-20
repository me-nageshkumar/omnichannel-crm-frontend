import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { Disabled, disabledText } from '@app/api/enablement';

/** "Enabled", or "Disabled" with who did it and at which level on hover. */
export const EnabledLabel: React.FunctionComponent<{ disabled: Disabled | null; text?: string }> = ({
  disabled,
  text = 'Disabled',
}) =>
  disabled ? (
    <Tooltip content={disabledText(disabled)}>
      <Label color="grey" tabIndex={0}>
        {text}
      </Label>
    </Tooltip>
  ) : (
    <Label color="green">Enabled</Label>
  );
