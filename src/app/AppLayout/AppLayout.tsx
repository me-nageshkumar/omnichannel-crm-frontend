import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  MenuToggle,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  SkipToContent,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { IAppRoute, routes } from '@app/routes';
import { BarsIcon, UserIcon } from '@patternfly/react-icons';
import { roleLabel } from '@app/api/users';
import { useSession } from '@app/session/SessionContext';

interface IAppLayout {
  children: React.ReactNode;
}

const UserMenu: React.FunctionComponent = () => {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  if (!user) return null;
  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={() => setIsOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(ref) => (
        <MenuToggle ref={ref} variant="plainText" icon={<UserIcon />} isExpanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
          {user.name}
        </MenuToggle>
      )}
    >
      <DropdownGroup label={`${user.name} · ${roleLabel(user.role)}`}>
        <DropdownList>
          <DropdownItem key="profile" onClick={() => navigate('/profile')}>
            Profile
          </DropdownItem>
        </DropdownList>
      </DropdownGroup>
      <Divider component="li" />
      <DropdownList>
        <DropdownItem key="logout" onClick={() => signOut()}>
          Log out
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

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
      <MastheadContent>
        <Toolbar isFullHeight isStatic>
          <ToolbarContent>
            <ToolbarGroup align={{ default: 'alignEnd' }}>
              <ToolbarItem>
                <UserMenu />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
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
