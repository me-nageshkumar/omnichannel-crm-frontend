import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import type { Authority } from '@app/api/authorities';
import { LEVEL_LABELS } from '@app/api/roles';

export const NOT_CHECKED_TEXT = 'No code checks this yet. It has no effect until it does.';

/** Why a wrong-level authority can never pass its check, phrased for its level. */
export function wrongLevelText(level: Authority['level']): string {
  return level === 'BRAND'
    ? 'Checked as a platform authority in code but created as Brand.'
    : `Checked as a brand authority in code but created as ${LEVEL_LABELS[level]}.`;
}

/** Nothing for an active authority; a warning or danger label, with the reason as a tooltip, otherwise. */
export const AuthorityStatusLabel: React.FunctionComponent<{ authority: Authority }> = ({ authority }) => {
  if (authority.status === 'NOT_CHECKED') {
    return (
      <Tooltip content={NOT_CHECKED_TEXT}>
        <Label isCompact color="orange" tabIndex={0}>
          Not checked
        </Label>
      </Tooltip>
    );
  }
  if (authority.status === 'WRONG_LEVEL') {
    return (
      <Tooltip content={wrongLevelText(authority.level)}>
        <Label isCompact color="red" tabIndex={0}>
          Wrong level
        </Label>
      </Tooltip>
    );
  }
  return null;
};
