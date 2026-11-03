import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  HelperText,
  HelperTextItem,
  MenuToggle,
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import type { AutomationAction, AutomationOptions, EventKind } from '@app/api/automations';
import { ACTIONS, actionSummary } from '@app/Automations/automationModel';
import { AddToCrmFields, addToCrmShows } from '@app/Automations/AddToCrmFields';
import { AssignChatModal } from '@app/Automations/AssignChatModal';
import { SendTemplateFields, sendTemplateShows } from '@app/Automations/SendTemplateFields';

const labelOf = (type: AutomationAction['type']) => ACTIONS.find((a) => a.type === type)?.label ?? type;

/** A new action of {@code type}, as the server takes it. */
export function newAction(type: AutomationAction['type']): AutomationAction {
  switch (type) {
    case 'SEND_TEMPLATE':
      return { type, templateId: null, values: {} };
    case 'ASSIGN_CHAT':
      return { type, mode: 'AGENT', userId: null, teamId: null, whenAway: null };
    case 'ADD_TO_CRM':
      return { type, pipelineId: null, stageId: null, dealTitle: null };
  }
}

const shownByFields = (type: AutomationAction['type'], key: string): boolean => {
  if (type === 'SEND_TEMPLATE') return sendTemplateShows(key);
  if (type === 'ADD_TO_CRM') return addToCrmShows(key);
  return false;
};

/** Assign chat: who gets the chat, in words; the dialog chooses it. */
const AssignChatBody: React.FunctionComponent<{
  action: AutomationAction;
  options: AutomationOptions;
  isDisabled: boolean;
  isOpen: boolean;
  onOpen(): void;
  onSave(a: AutomationAction): void;
  onCancel(): void;
}> = ({ action, options, isDisabled, isOpen, onOpen, onSave, onCancel }) => {
  const chosen = Boolean(action.userId || action.teamId);
  return (
    <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
      <Content component="p">{chosen ? actionSummary(action, options) : 'Nobody is chosen yet.'}</Content>
      <Button variant="link" isInline isDisabled={isDisabled} onClick={onOpen}>
        {chosen ? 'Change…' : 'Choose…'}
      </Button>
      {isOpen && <AssignChatModal action={action} options={options} onSave={onSave} onCancel={onCancel} />}
    </Flex>
  );
};

const AddActionMenu: React.FunctionComponent<{
  event: EventKind;
  isDisabled: boolean;
  onAdd(type: AutomationAction['type']): void;
}> = ({ event, isDisabled, onAdd }) => {
  const [open, setOpen] = React.useState(false);
  const offered = ACTIONS.filter((a) => a.type !== 'ADD_TO_CRM' || event === 'MESSAGE_RECEIVED');
  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={() => setOpen(false)}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          variant="secondary"
          icon={<PlusCircleIcon />}
          isDisabled={isDisabled}
          isExpanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Add action
        </MenuToggle>
      )}
    >
      <DropdownList>
        {offered.map((a) => (
          <DropdownItem key={a.type} description={a.description} onClick={() => onAdd(a.type)}>
            {a.label}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

/** The Then of a rule: its actions in order, one card each, and Add action. */
export const ActionList: React.FunctionComponent<{
  event: EventKind;
  actions: AutomationAction[];
  options: AutomationOptions;
  errors: Record<number, Record<string, string>>;
  isDisabled: boolean;
  onChange(next: AutomationAction[]): void;
}> = ({ event, actions, options, errors, isDisabled, onChange }) => {
  // the action whose dialog is open, and whether it was just added (cancelling then removes it)
  const [dialog, setDialog] = React.useState<{ index: number; fresh: boolean } | null>(null);
  const replace = (i: number, a: AutomationAction) => onChange(actions.map((x, j) => (j === i ? a : x)));
  const swap = (i: number, j: number) => {
    const next = actions.slice();
    next[i] = actions[j];
    next[j] = actions[i];
    onChange(next);
  };
  return (
    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
      {actions.map((a, i) => {
        const title = `${i + 1}. ${labelOf(a.type)}`;
        const cardErrors = errors[i] ?? {};
        const others = Object.keys(cardErrors).filter((k) => !shownByFields(a.type, k));
        const fieldProps = {
          action: a,
          options,
          errors: cardErrors,
          isDisabled,
          onChange: (next: AutomationAction) => replace(i, next),
        };
        return (
          <Card key={i} component="section" aria-label={title} isCompact>
            <CardHeader
              actions={{
                hasNoOffset: true,
                actions: (
                  <>
                    <Button variant="link" isInline isDisabled={isDisabled || i === 0} onClick={() => swap(i, i - 1)}>
                      Move up
                    </Button>{' '}
                    <Button
                      variant="link"
                      isInline
                      isDisabled={isDisabled || i === actions.length - 1}
                      onClick={() => swap(i, i + 1)}
                    >
                      Move down
                    </Button>{' '}
                    <Button
                      variant="link"
                      isInline
                      isDanger
                      isDisabled={isDisabled}
                      onClick={() => onChange(actions.filter((_x, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </>
                ),
              }}
            >
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardBody>
              {/* inside the page's form: a nested form element is not allowed */}
              <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                {a.type === 'SEND_TEMPLATE' && <SendTemplateFields {...fieldProps} />}
                {a.type === 'ADD_TO_CRM' && <AddToCrmFields {...fieldProps} />}
                {a.type === 'ASSIGN_CHAT' && (
                  <AssignChatBody
                    action={a}
                    options={options}
                    isDisabled={isDisabled}
                    isOpen={dialog?.index === i}
                    onOpen={() => setDialog({ index: i, fresh: false })}
                    onSave={(next) => {
                      replace(i, next);
                      setDialog(null);
                    }}
                    onCancel={() => {
                      if (dialog?.fresh) onChange(actions.filter((_x, j) => j !== i));
                      setDialog(null);
                    }}
                  />
                )}
                {others.length > 0 && (
                  <HelperText>
                    {others.map((k) => (
                      <HelperTextItem key={k} variant="error">
                        {cardErrors[k]}
                      </HelperTextItem>
                    ))}
                  </HelperText>
                )}
              </Flex>
            </CardBody>
          </Card>
        );
      })}
      <div>
        <AddActionMenu
          event={event}
          isDisabled={isDisabled}
          onAdd={(type) => {
            onChange(actions.concat(newAction(type)));
            if (type === 'ASSIGN_CHAT') setDialog({ index: actions.length, fresh: true });
          }}
        />
      </div>
    </Flex>
  );
};
