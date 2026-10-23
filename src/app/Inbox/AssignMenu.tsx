import * as React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuToggle,
} from '@patternfly/react-core';
import { Assignees, Availability, ChatView, assignChat, getAssignees, unassignChat } from '@app/api/inbox';
import { AvailabilityDot } from '@app/Inbox/ReassignMenu';
import { useSession } from '@app/session/SessionContext';

const Submenu: React.FunctionComponent<{
  entries: Array<{ id: string; name: string; availability?: Availability }>;
  empty: string;
  onPick(id: string): void;
}> = ({ entries, empty, onPick }) => (
  <Menu onSelect={(_e, id) => onPick(String(id))}>
    <MenuContent>
      <MenuList>
        {entries.length === 0 ? (
          <MenuItem isDisabled>{empty}</MenuItem>
        ) : (
          entries.map((e) => (
            <MenuItem key={e.id} itemId={e.id}>
              {e.name}
              {e.availability && <AvailabilityDot status={e.availability} />}
            </MenuItem>
          ))
        )}
      </MenuList>
    </MenuContent>
  </Menu>
);

/** Assign the chat to an agent or a team, or take the assignment away. Fetches the choices when first opened. */
export const AssignMenu: React.FunctionComponent<{
  chat: ChatView;
  onChange(chat: ChatView): void;
  onError(error: unknown): void;
}> = ({ chat, onChange, onError }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [open, setOpen] = React.useState(false);
  const [assignees, setAssignees] = React.useState<Assignees | null>(null);

  const toggle = (next: boolean) => {
    setOpen(next);
    if (next && !assignees && token) {
      getAssignees(token, ws, chat.phoneNumberId).then(setAssignees, onError);
    }
  };

  const run = (action: Promise<ChatView>) => {
    setOpen(false);
    action.then(onChange, onError);
  };

  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      popperProps={{ position: 'right' }}
      toggle={(ref) => (
        <MenuToggle ref={ref} isExpanded={open} onClick={() => toggle(!open)}>
          Assign
        </MenuToggle>
      )}
    >
      <DropdownList>
        <MenuItem
          flyoutMenu={
            <Submenu
              entries={assignees?.users ?? []}
              empty={assignees ? 'No agents' : 'Loading…'}
              onPick={(userId) => run(assignChat(token as string, ws, chat.id, { userId }))}
            />
          }
        >
          Assign to agent…
        </MenuItem>
        <MenuItem
          flyoutMenu={
            <Submenu
              entries={assignees?.teams ?? []}
              empty={assignees ? 'No teams' : 'Loading…'}
              onPick={(teamId) => run(assignChat(token as string, ws, chat.id, { teamId }))}
            />
          }
        >
          Assign to team…
        </MenuItem>
        <DropdownItem
          isDisabled={!chat.assignedUser && !chat.assignedTeam}
          onClick={() => run(unassignChat(token as string, ws, chat.id))}
        >
          Unassign
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};
