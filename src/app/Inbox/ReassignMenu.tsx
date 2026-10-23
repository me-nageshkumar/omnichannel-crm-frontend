import * as React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Label,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuToggle,
} from '@patternfly/react-core';
import { Assignees, Availability, ChatView, getAssignees, handoffChat } from '@app/api/inbox';
import { useSession } from '@app/session/SessionContext';

/** A small Available / Away mark after a name. */
export const AvailabilityDot: React.FunctionComponent<{ status: Availability }> = ({ status }) => (
  <Label isCompact color={status === 'AVAILABLE' ? 'green' : 'grey'} style={{ marginInlineStart: 'var(--pf-t--global--spacer--xs)' }}>
    {status === 'AVAILABLE' ? 'Available' : 'Away'}
  </Label>
);

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

/**
 * The assignee passes the chat on (design §3.6): to a teammate, back to the team (routing runs again without them),
 * or to another team (that team's routing runs). The choices are fetched for the chat's number when first opened.
 */
export const ReassignMenu: React.FunctionComponent<{
  chat: ChatView;
  onChange(chat: ChatView): void;
  onError(error: unknown): void;
}> = ({ chat, onChange, onError }) => {
  const { token, user, workspace } = useSession();
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
  const teammates = (assignees?.users ?? []).filter((u) => u.id !== user?.id);
  const otherTeams = (assignees?.teams ?? []).filter((t) => t.id !== chat.assignedTeam?.id);
  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      popperProps={{ position: 'right' }}
      toggle={(ref) => (
        <MenuToggle ref={ref} isExpanded={open} onClick={() => toggle(!open)}>
          Reassign
        </MenuToggle>
      )}
    >
      <DropdownList>
        <MenuItem
          flyoutMenu={
            <Submenu
              entries={teammates}
              empty={assignees ? 'No teammates' : 'Loading…'}
              onPick={(userId) => run(handoffChat(token as string, ws, chat.id, { kind: 'TO_USER', userId }))}
            />
          }
        >
          Teammate…
        </MenuItem>
        <DropdownItem
          isDisabled={!chat.assignedTeam}
          onClick={() => run(handoffChat(token as string, ws, chat.id, { kind: 'TO_TEAM' }))}
        >
          Back to team
        </DropdownItem>
        <MenuItem
          flyoutMenu={
            <Submenu
              entries={otherTeams}
              empty={assignees ? 'No other teams' : 'Loading…'}
              onPick={(teamId) => run(handoffChat(token as string, ws, chat.id, { kind: 'TO_TEAM', teamId }))}
            />
          }
        >
          Another team…
        </MenuItem>
      </DropdownList>
    </Dropdown>
  );
};
