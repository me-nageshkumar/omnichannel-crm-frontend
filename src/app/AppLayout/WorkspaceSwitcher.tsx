import * as React from 'react';
import { Dropdown, DropdownItem, DropdownList, MenuToggle } from '@patternfly/react-core';
import { useSession } from '@app/session/SessionContext';

/** Masthead brand picker: a menu with two or more brands, a plain label with one, nothing with none. */
export const WorkspaceSwitcher: React.FunctionComponent = () => {
  const { user, workspace, selectWorkspace } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const workspaces = user?.workspaces ?? [];
  if (!workspace) return null;
  const label = `Brand: ${workspace.name}`;
  if (workspaces.length === 1) return <span>{label}</span>;
  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={() => setIsOpen(false)}
      toggle={(ref) => (
        <MenuToggle ref={ref} variant="plainText" isExpanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
          {label}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {workspaces.map((w) => (
          <DropdownItem key={w.id} isSelected={w.id === workspace.id} onClick={() => selectWorkspace(w.id)}>
            {w.name}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};
