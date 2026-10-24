import * as React from 'react';
import { EmptyState, EmptyStateBody, PageSection } from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';

/** Shown in place of a CRM page when the brand's CRM is switched off. */
export const CrmOffState: React.FunctionComponent = () => (
  <PageSection hasBodyWrapper={false}>
    <EmptyState titleText="CRM is not switched on for this brand" headingLevel="h1" icon={CubesIcon} variant="lg">
      <EmptyStateBody>Ask your account manager to switch it on.</EmptyStateBody>
    </EmptyState>
  </PageSection>
);
