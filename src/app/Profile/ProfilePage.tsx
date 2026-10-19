import * as React from 'react';
import { PageSection, Title } from '@patternfly/react-core';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';

const ProfilePage: React.FunctionComponent = () => {
  useDocumentTitle('Profile | Omnichannel CRM');
  return (
    <PageSection hasBodyWrapper={false}>
      <Title headingLevel="h1" size="lg">
        Profile
      </Title>
    </PageSection>
  );
};

export { ProfilePage };
