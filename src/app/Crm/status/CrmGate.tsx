import * as React from 'react';
import { Bullseye, Button, EmptyState, EmptyStateActions, EmptyStateBody, EmptyStateFooter, PageSection, Spinner } from '@patternfly/react-core';
import { CrmOffState } from '@app/Crm/common/CrmOffState';
import { useCrmStatus } from '@app/Crm/status/CrmStatusContext';

/** Renders its page only when the brand's CRM is on; a spinner while that is unknown, the off state otherwise. */
export const CrmGate: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const { status, loading, error, reload } = useCrmStatus();
  if (loading) {
    return (
      <Bullseye>
        <Spinner aria-label="Loading" />
      </Bullseye>
    );
  }
  if (error) {
    return (
      <PageSection hasBodyWrapper={false}>
        <EmptyState titleText="Couldn't check whether the CRM is on" headingLevel="h1" variant="lg">
          <EmptyStateBody>Something went wrong while loading the CRM status.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={reload}>
                Retry
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      </PageSection>
    );
  }
  return status?.enabled ? <>{children}</> : <CrmOffState />;
};
