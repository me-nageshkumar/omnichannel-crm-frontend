import * as React from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  PageSection,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import { roleLabel } from '@app/api/users';
import { useSession } from '@app/session/SessionContext';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';
import { TwoFactorCard } from '@app/Profile/TwoFactorCard';

const ProfilePage: React.FunctionComponent = () => {
  useDocumentTitle('Profile | Omnichannel CRM');
  const { user } = useSession();
  const details: Array<[string, string | null | undefined]> = [
    ['Name', user?.name],
    ['Username', user?.username],
    ['Email', user?.email],
    ['Mobile', user?.mobileNumber],
    ['Role', user ? roleLabel(user.role) : null],
  ];

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1" size="lg">
          Profile
        </Title>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Stack hasGutter>
          <StackItem>
            <Card component="section" aria-labelledby="details-title">
              <CardTitle id="details-title">Your details</CardTitle>
              <CardBody>
                <DescriptionList isHorizontal>
                  {details.map(([term, value]) => (
                    <DescriptionListGroup key={term}>
                      <DescriptionListTerm>{term}</DescriptionListTerm>
                      <DescriptionListDescription>{value || '—'}</DescriptionListDescription>
                    </DescriptionListGroup>
                  ))}
                </DescriptionList>
              </CardBody>
            </Card>
          </StackItem>
          <StackItem>
            <TwoFactorCard />
          </StackItem>
        </Stack>
      </PageSection>
    </>
  );
};

export { ProfilePage };
