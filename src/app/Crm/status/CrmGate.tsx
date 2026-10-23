import * as React from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { CrmOffState } from '@app/Crm/common/CrmOffState';
import { useCrmStatus } from '@app/Crm/status/CrmStatusContext';

/** Renders its page only when the brand's CRM is on; a spinner while that is unknown, the off state otherwise. */
export const CrmGate: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const { status, loading } = useCrmStatus();
  if (loading) {
    return (
      <Bullseye>
        <Spinner aria-label="Loading" />
      </Bullseye>
    );
  }
  return status?.enabled ? <>{children}</> : <CrmOffState />;
};
