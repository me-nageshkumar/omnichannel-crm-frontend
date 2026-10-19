import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Masthead,
  MastheadBrand,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  SkipToContent,
  Title,
} from '@patternfly/react-core';
import { IAppRoute, routes } from '@app/routes';
import { BarsIcon } from '@patternfly/react-icons';

interface IAppLayout {
  children: React.ReactNode;
}

const AppLayout: React.FunctionComponent<IAppLayout> = ({ children }) => {
  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton variant="plain" aria-label="Global navigation">
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        <MastheadBrand>
          <MastheadLogo component="a" href="/">
            <Title headingLevel="h1" size="lg">
              Omnichannel CRM
            </Title>
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
    </Masthead>
  );

  const location = useLocation();

  const renderNavItem = (route: IAppRoute, index: number) => (
    <NavItem key={`${route.label}-${index}`} id={`${route.label}-${index}`} isActive={route.path === location.pathname}>
      <NavLink
        to={route.path}
      >
        {route.label}
      </NavLink>
    </NavItem>
  );

  const Navigation = (
    <Nav id="nav-primary-simple">
      <NavList id="nav-list-simple">
        {routes.map((route, idx) => route.label && renderNavItem(route, idx))}
      </NavList>
    </Nav>
  );

  const Sidebar = (
    <PageSidebar>
      <PageSidebarBody>{Navigation}</PageSidebarBody>
    </PageSidebar>
  );

  const pageId = 'primary-app-container';

  const PageSkipToContent = (
    <SkipToContent
      onClick={(event) => {
        event.preventDefault();
        const primaryContentContainer = document.getElementById(pageId);
        primaryContentContainer?.focus();
      }}
      href={`#${pageId}`}
    >
      Skip to Content
    </SkipToContent>
  );
  return (
    <Page
      mainContainerId={pageId}
      masthead={masthead}
      isManagedSidebar
      sidebar={Sidebar}
      skipToContent={PageSkipToContent}
    >
      {children}
    </Page>
  );
};

export { AppLayout };
