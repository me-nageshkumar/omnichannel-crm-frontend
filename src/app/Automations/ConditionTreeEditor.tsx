import * as React from 'react';
import {
  Button,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import type { AutomationOptions, ConditionGroup, EventKind } from '@app/api/automations';
import {
  MAX_CONDITIONS,
  MAX_DEPTH,
  type Path,
  addTo,
  countRules,
  isGroup,
  newGroup,
  newLeaf,
  nodeAt,
  removeAt,
  replaceAt,
  rulePath,
} from '@app/Automations/automationModel';
import { ConditionRow } from '@app/Automations/ConditionRow';

const SPACER = 'var(--pf-t--global--spacer--md)';
const NESTED: React.CSSProperties = {
  borderInlineStart: '2px solid var(--pf-t--global--border--color--default)',
  paddingInlineStart: SPACER,
};
const COMBINATORS: Array<['and' | 'or', string]> = [
  ['and', 'All of these'],
  ['or', 'Any of these'],
];
const EVENT_PHRASE: Record<EventKind, string> = {
  MESSAGE_RECEIVED: 'message that comes in',
  DEAL_LANE_CHANGED: 'deal that moves to another lane',
};

const groupName = (path: Path) => (path.length === 0 ? 'Conditions' : `Group ${path.map((i) => i + 1).join('.')}`);
const leafName = (path: Path) => `Condition ${path.map((i) => i + 1).join('.')}`;

/** {@code root} without the node at {@code path}, and without the groups that leaves empty; null when nothing is left. */
function withoutNode(root: ConditionGroup, path: Path): ConditionGroup | null {
  let next = removeAt(root, path);
  let parent = path.slice(0, -1);
  while (parent.length > 0 && (nodeAt(next, parent) as ConditionGroup).rules.length === 0) {
    next = removeAt(next, parent);
    parent = parent.slice(0, -1);
  }
  return next.rules.length === 0 ? null : next;
}

type TreeProps = {
  event: EventKind;
  options: AutomationOptions;
  errors: Record<string, string>;
  isDisabled: boolean;
};

const GroupEditor: React.FunctionComponent<
  TreeProps & {
    root: ConditionGroup;
    group: ConditionGroup;
    path: Path;
    onChange(next: ConditionGroup | null): void;
  }
> = ({ root, group, path, onChange, event, options, errors, isDisabled }) => {
  const name = groupName(path);
  const error = errors[rulePath(path)];
  const roomForOne = countRules(root) < MAX_CONDITIONS;
  const canAddGroup = roomForOne && path.length + 1 < MAX_DEPTH;
  return (
    <div role="group" aria-label={name} style={path.length > 0 ? NESTED : undefined}>
      <GroupToolbar
        name={name}
        combinator={group.combinator}
        canAddCondition={roomForOne}
        canAddGroup={canAddGroup}
        canRemove={path.length > 0}
        isDisabled={isDisabled}
        onCombinator={(combinator) => onChange(replaceAt(root, path, { ...group, combinator }))}
        onAddCondition={() => onChange(addTo(root, path, newLeaf(event)))}
        onAddGroup={() => onChange(addTo(root, path, { ...newGroup(), rules: [newLeaf(event)] }))}
        onRemove={() => onChange(withoutNode(root, path))}
      />
      {error && (
        <HelperText>
          <HelperTextItem variant="error">{error}</HelperTextItem>
        </HelperText>
      )}
      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }} style={{ marginTop: SPACER }}>
        {group.rules.map((node, i) => {
          const at = path.concat(i);
          return (
            <FlexItem key={i}>
              {isGroup(node) ? (
                <GroupEditor
                  root={root}
                  group={node}
                  path={at}
                  onChange={onChange}
                  event={event}
                  options={options}
                  errors={errors}
                  isDisabled={isDisabled}
                />
              ) : (
                <div role="group" aria-label={leafName(at)}>
                  <ConditionRow
                    event={event}
                    leaf={node}
                    options={options}
                    error={errors[rulePath(at)]}
                    isDisabled={isDisabled}
                    onChange={(leaf) => onChange(replaceAt(root, at, leaf))}
                    onRemove={() => onChange(withoutNode(root, at))}
                  />
                </div>
              )}
            </FlexItem>
          );
        })}
      </Flex>
    </div>
  );
};

const GroupToolbar: React.FunctionComponent<{
  name: string;
  combinator: 'and' | 'or' | null;
  canAddCondition: boolean;
  canAddGroup: boolean;
  canRemove: boolean;
  isDisabled: boolean;
  onCombinator(c: 'and' | 'or'): void;
  onAddCondition(): void;
  onAddGroup(): void;
  onRemove(): void;
}> = (p) => (
  <div role="toolbar" aria-label={`${p.name} actions`}>
    <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
      {p.combinator && (
        <FlexItem>
          <ToggleGroup aria-label="Combinator">
            {COMBINATORS.map(([c, text]) => (
              <ToggleGroupItem
                key={c}
                text={text}
                isSelected={p.combinator === c}
                isDisabled={p.isDisabled}
                onChange={() => p.onCombinator(c)}
              />
            ))}
          </ToggleGroup>
        </FlexItem>
      )}
      {p.canAddCondition && (
        <FlexItem>
          <Button variant="link" icon={<PlusCircleIcon />} isDisabled={p.isDisabled} onClick={p.onAddCondition}>
            Add condition
          </Button>
        </FlexItem>
      )}
      {p.canAddGroup && (
        <FlexItem>
          <Button variant="link" icon={<PlusCircleIcon />} isDisabled={p.isDisabled} onClick={p.onAddGroup}>
            Add group
          </Button>
        </FlexItem>
      )}
      {p.canRemove && (
        <FlexItem>
          <Button variant="link" isDanger isDisabled={p.isDisabled} onClick={p.onRemove}>
            Remove group
          </Button>
        </FlexItem>
      )}
    </Flex>
  </div>
);

/** The If of a rule: groups of conditions joined by "All of these" / "Any of these", as the segment editor's. */
export const ConditionTreeEditor: React.FunctionComponent<
  TreeProps & { root: ConditionGroup | null; onChange(next: ConditionGroup | null): void }
> = ({ root, onChange, event, options, errors, isDisabled }) => {
  if (!root) {
    const start = (first: ConditionGroup['rules'][number]) => onChange({ ...newGroup(), rules: [first] });
    return (
      <div role="group" aria-label="Conditions">
        <GroupToolbar
          name="Conditions"
          combinator={null}
          canAddCondition
          canAddGroup
          canRemove={false}
          isDisabled={isDisabled}
          onCombinator={() => undefined}
          onAddCondition={() => start(newLeaf(event))}
          onAddGroup={() => start({ ...newGroup(), rules: [newLeaf(event)] })}
          onRemove={() => undefined}
        />
        <p>No conditions: every {EVENT_PHRASE[event]} runs this rule.</p>
        {errors.rules && (
          <HelperText>
            <HelperTextItem variant="error">{errors.rules}</HelperTextItem>
          </HelperText>
        )}
      </div>
    );
  }
  return (
    <GroupEditor
      root={root}
      group={root}
      path={[]}
      onChange={onChange}
      event={event}
      options={options}
      errors={errors}
      isDisabled={isDisabled}
    />
  );
};
