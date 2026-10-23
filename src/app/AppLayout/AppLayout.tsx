import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  NavExpandable,
  NavItem,
  NavItemSeparator,
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
import { NavEntry, NavLinkEntry, isExpandable, useNavSections } from '@app/routes';
import { BarsIcon, UserIcon } from '@patternfly/react-icons';
import { userRoleLabel } from '@app/api/users';
import { AvailabilitySwitch } from '@app/AppLayout/AvailabilitySwitch';
import { WorkspaceSwitcher } from '@app/AppLayout/WorkspaceSwitcher';
import { ThemeSwitcher } from '@app/theme/ThemeSwitcher';
import { useSession } from '@app/session/SessionContext';

interface IAppLayout {
  children: React.ReactNode;
}

const UserMenu: React.FunctionComponent = () => {
  const { user, workspace, signOut } = useSession();
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
      <DropdownGroup label={[user.name, userRoleLabel(user, workspace)].filter(Boolean).join(' · ')}>
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

/** The nav path the page falls under: the longest one that is the pathname or a parent of it. */
function currentNavPath(sections: NavEntry[][], pathname: string): string | undefined {
  const paths = sections.flat().flatMap((entry) => (isExpandable(entry) ? entry.links : [entry])).map((link) => link.path);
  return paths
    .filter((path) => path === pathname || (path !== '/' && pathname.startsWith(`${path}/`)))
    .sort((a, b) => b.length - a.length)[0];
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
      <MastheadContent>
        <Toolbar isFullHeight isStatic>
          <ToolbarContent>
            <ToolbarGroup align={{ default: 'alignEnd' }}>
              <ToolbarItem>
                <WorkspaceSwitcher />
              </ToolbarItem>
              <ToolbarItem>
                <ThemeSwitcher />
              </ToolbarItem>
              <ToolbarItem>
                <AvailabilitySwitch />
              </ToolbarItem>
              <ToolbarItem>
                <UserMenu />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  const { pathname } = useLocation();
  const sections = useNavSections();
  const current = currentNavPath(sections, pathname);

  const renderLink = (link: NavLinkEntry) => (
    <NavItem key={link.path} isActive={link.path === current}>
      <Link to={link.path}>{link.label}</Link>
    </NavItem>
  );

  const renderEntry = (entry: NavEntry) => {
    if (!isExpandable(entry)) return renderLink(entry);
    const holdsCurrent = entry.links.some((link) => link.path === current);
    return (
      <NavExpandable key={entry.label} title={entry.label} isActive={holdsCurrent} isExpanded={holdsCurrent}>
        {entry.links.map(renderLink)}
      </NavExpandable>
    );
  };

  const Navigation = (
    <Nav id="nav-primary" aria-label="Global">
      <NavList>
        {sections.map((section, index) => (
          <React.Fragment key={index}>
            {index > 0 && <NavItemSeparator />}
            {section.map(renderEntry)}
          </React.Fragment>
        ))}
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
