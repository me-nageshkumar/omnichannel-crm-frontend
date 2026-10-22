import * as React from 'react';
import {
  Button,
  Checkbox,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import type { Combinator, ContactAttribute, ContactLabel, RuleGroup } from '@app/api/contacts';
import { RuleEditor } from '@app/Contacts/Filters/RuleEditor';
import {
  Path,
  addTo,
  canAddGroup,
  canAddRule,
  emptyGroup,
  isGroup,
  newRule,
  nodeName,
  removeAt,
  replaceAt,
  rulePath,
} from '@app/Contacts/Filters/filterModel';

const SPACER = 'var(--pf-t--global--spacer--md)';
const NESTED: React.CSSProperties = {
  borderInlineStart: '2px solid var(--pf-t--global--border--color--default)',
  paddingInlineStart: SPACER,
};
// A fieldset that only groups the controls for `disabled`; it draws nothing.
const PLAIN_FIELDSET: React.CSSProperties = { border: 0, margin: 0, padding: 0, minInlineSize: 0 };
const COMBINATORS: Array<[Combinator, string]> = [
  ['and', 'All of these'],
  ['or', 'Any of these'],
];

interface TreeProps {
  labels: ContactLabel[];
  attributes: ContactAttribute[];
  errors?: Record<string, string>;
  /** Locks every control, e.g. while the filter is being saved. */
  isDisabled?: boolean;
}

/** One group: its toolbar, its error, then its children in order. Every change goes back as a new root. */
const GroupEditor: React.FunctionComponent<
  TreeProps & { root: RuleGroup; group: RuleGroup; path: Path; onChange(next: RuleGroup): void }
> = ({ root, group, path, onChange, labels, attributes, errors, isDisabled }) => {
  const name = nodeName(path, true);
  const error = errors?.[rulePath(path)];
  const set = (patch: Partial<RuleGroup>) => onChange(replaceAt(root, path, { ...group, ...patch }));
  return (
    <div role="group" aria-label={name} style={path.length > 0 ? NESTED : undefined}>
      <div role="toolbar" aria-label={`${name} actions`}>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>
            <ToggleGroup aria-label="Combinator">
              {COMBINATORS.map(([c, text]) => (
                <ToggleGroupItem
                  key={c}
                  text={text}
                  isSelected={group.combinator === c}
                  onChange={() => set({ combinator: c })}
                />
              ))}
            </ToggleGroup>
          </FlexItem>
          <FlexItem>
            <Checkbox
              id={`not-${rulePath(path)}`}
              label="Not"
              isChecked={group.not}
              isDisabled={isDisabled}
              onChange={(_e, not) => set({ not })}
            />
          </FlexItem>
          <FlexItem>
            <Button
              variant="link"
              icon={<PlusCircleIcon />}
              isDisabled={!canAddRule(root)}
              onClick={() => onChange(addTo(root, path, newRule()))}
            >
              Add rule
            </Button>
          </FlexItem>
          <FlexItem>
            <Button
              variant="link"
              icon={<PlusCircleIcon />}
              isDisabled={!canAddGroup(root, path)}
              onClick={() => onChange(addTo(root, path, emptyGroup()))}
            >
              Add group
            </Button>
          </FlexItem>
          {path.length > 0 && (
            <FlexItem>
              <Button variant="link" isDanger onClick={() => onChange(removeAt(root, path))}>
                Remove group
              </Button>
            </FlexItem>
          )}
        </Flex>
      </div>
      {error && (
        <HelperText>
          <HelperTextItem variant="error">{error}</HelperTextItem>
        </HelperText>
      )}
      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }} style={{ marginTop: SPACER }}>
        {group.rules.map((node, i) => {
          const at = [...path, i];
          // Keyed by position so an input keeps its DOM node (and focus) while its rule is edited.
          return (
            <FlexItem key={i}>
              {isGroup(node) ? (
                <GroupEditor
                  root={root}
                  group={node}
                  path={at}
                  onChange={onChange}
                  labels={labels}
                  attributes={attributes}
                  errors={errors}
                  isDisabled={isDisabled}
                />
              ) : (
                <RuleEditor
                  rule={node}
                  path={at}
                  labels={labels}
                  attributes={attributes}
                  error={errors?.[rulePath(at)]}
                  isDisabled={isDisabled}
                  onChange={(r) => onChange(replaceAt(root, at, r))}
                  onRemove={() => onChange(removeAt(root, at))}
                />
              )}
            </FlexItem>
          );
        })}
      </Flex>
    </div>
  );
};

/**
 * The recursive rules editor for an advanced filter; errors are keyed by rulePath. {@code isDisabled}
 * disables the fieldset, so no control can change the tree (the label picker included); the form
 * controls also take it for their disabled look.
 */
export const RuleTreeEditor: React.FunctionComponent<
  TreeProps & { value: RuleGroup; onChange(next: RuleGroup): void }
> = ({ value, onChange, labels, attributes, errors, isDisabled = false }) => (
  <fieldset disabled={isDisabled} style={PLAIN_FIELDSET}>
    <GroupEditor
      root={value}
      group={value}
      path={[]}
      onChange={onChange}
      labels={labels}
      attributes={attributes}
      errors={errors}
      isDisabled={isDisabled}
    />
  </fieldset>
);
