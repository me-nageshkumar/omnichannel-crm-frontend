import * as React from 'react';
import { EmptyState, EmptyStateBody, PageSection, Title } from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { useSession } from '@app/session/SessionContext';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';

const Dashboard: React.FunctionComponent = () => {
  useDocumentTitle('Dashboard | Omnichannel CRM');
  const { user } = useSession();
  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1" size="lg">
          Dashboard
        </Title>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <EmptyState titleText={`Welcome, ${user?.name ?? ''}`} headingLevel="h2" icon={CubesIcon}>
          <EmptyStateBody>This is where your channels and leads will appear.</EmptyStateBody>
        </EmptyState>
      </PageSection>
    </>
  );
};

export { Dashboard };
