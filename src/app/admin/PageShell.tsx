import * as React from 'react';
import { Flex, FlexItem, PageSection, Title } from '@patternfly/react-core';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';

/** Title row with optional actions, then the page body. */
export const PageShell: React.FunctionComponent<{
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, actions, children }) => {
  useDocumentTitle(`${title} | Omnichannel CRM`);
  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="lg">
              {title}
            </Title>
          </FlexItem>
          {actions && <FlexItem>{actions}</FlexItem>}
        </Flex>
      </PageSection>
      {children && <PageSection hasBodyWrapper={false}>{children}</PageSection>}
    </>
  );
};
