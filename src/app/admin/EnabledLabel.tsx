import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { Disabled, disabledText } from '@app/api/enablement';

/**
 * "Enabled", or "Disabled" with who did it and at which level on hover. {@code active} false without a
 * record (switched off before levels were recorded) still reads Disabled, without the tooltip.
 */
export const EnabledLabel: React.FunctionComponent<{ disabled: Disabled | null; active?: boolean; text?: string }> = ({
  disabled,
  active = true,
  text = 'Disabled',
}) => {
  if (disabled) {
    return (
      <Tooltip content={disabledText(disabled)}>
        <Label color="grey" tabIndex={0}>
          {text}
        </Label>
      </Tooltip>
    );
  }
  if (!active) return <Label color="grey">{text}</Label>;
  return <Label color="green">Enabled</Label>;
};
