import * as React from 'react';
import { Alert, AlertActionLink } from '@patternfly/react-core';

/** Shown when the server refuses a save because someone else saved first; Reload fetches their version. */
export const ConflictAlert: React.FunctionComponent<{ onReload(): void }> = ({ onReload }) => (
  <Alert
    variant="warning"
    isInline
    title="Someone else changed this. Reload to see their changes."
    actionLinks={<AlertActionLink onClick={onReload}>Reload</AlertActionLink>}
  />
);

export const isCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === code;
