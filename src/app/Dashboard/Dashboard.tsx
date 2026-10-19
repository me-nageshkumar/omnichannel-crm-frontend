import * as React from 'react';
import { PageSection, Title } from '@patternfly/react-core';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';

const Dashboard: React.FunctionComponent = () => {
  useDocumentTitle('Dashboard | Omnichannel CRM');
  return (
    <PageSection hasBodyWrapper={false}>
      <Title headingLevel="h1" size="lg">
        Dashboard
      </Title>
    </PageSection>
  );
};

export { Dashboard };
