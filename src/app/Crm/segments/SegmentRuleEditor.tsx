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
import type { ContactLabel } from '@app/api/contacts';
import type { SegmentFieldCatalog, SegmentRuleGroup } from '@app/api/crm';
import type { FieldUser } from '@app/Crm/common/fields/types';
import {
  type Path,
  addTo,
  canAddGroup,
  canAddRule,
  dealRulesIn,
  emptyGroup,
  errorFor,
  isGroup,
  newRule,
  nodeName,
  removeAt,
  removeRule,
  replaceAt,
  rulePath,
  withRuleChanged,
} from '@app/Crm/segments/segmentModel';
import { SegmentRuleRow } from '@app/Crm/segments/SegmentRuleRow';

export const SAME_DEAL_HINT = 'All deal conditions in this group must match the same deal.';

const SPACER = 'var(--pf-t--global--spacer--md)';
const NESTED: React.CSSProperties = {
  borderInlineStart: '2px solid var(--pf-t--global--border--color--default)',
  paddingInlineStart: SPACER,
};
const PLAIN_FIELDSET: React.CSSProperties = { border: 0, margin: 0, padding: 0, minInlineSize: 0 };
const COMBINATORS: Array<['and' | 'or', string]> = [
  ['and', 'All of these'],
  ['or', 'Any of these'],
];

interface TreeProps {
  catalog: SegmentFieldCatalog;
  labels: ContactLabel[];
  users: FieldUser[];
  errors: Record<string, string>;
  isDisabled?: boolean;
}

const GroupEditor: React.FunctionComponent<
  TreeProps & { root: SegmentRuleGroup; group: SegmentRuleGroup; path: Path; onChange(next: SegmentRuleGroup): void }
> = ({ root, group, path, onChange, catalog, labels, users, errors, isDisabled }) => {
  const name = nodeName(path, true);
  const error = errorFor(errors, path);
  const set = (patch: Partial<SegmentRuleGroup>) => onChange(replaceAt(root, path, { ...group, ...patch }));
  const sameDeal = group.combinator === 'and' && dealRulesIn(group).length >= 2;
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
                  isDisabled={isDisabled}
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
              isDisabled={isDisabled || !canAddRule(root)}
              onClick={() => onChange(addTo(root, path, newRule()))}
            >
              Add rule
            </Button>
          </FlexItem>
          <FlexItem>
            <Button
              variant="link"
              icon={<PlusCircleIcon />}
              isDisabled={isDisabled || !canAddGroup(root, path)}
              onClick={() => onChange(addTo(root, path, emptyGroup()))}
            >
              Add group
            </Button>
          </FlexItem>
          {path.length > 0 && (
            <FlexItem>
              <Button variant="link" isDanger isDisabled={isDisabled} onClick={() => onChange(removeAt(root, path))}>
                Remove group
              </Button>
            </FlexItem>
          )}
        </Flex>
      </div>
      {(sameDeal || error) && (
        <HelperText>
          {sameDeal && <HelperTextItem>{SAME_DEAL_HINT}</HelperTextItem>}
          {error && <HelperTextItem variant="error">{error}</HelperTextItem>}
        </HelperText>
      )}
      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }} style={{ marginTop: SPACER }}>
        {group.rules.map((node, i) => {
          const at = [...path, i];
          return (
            <FlexItem key={i}>
              {isGroup(node) ? (
                <GroupEditor
                  root={root}
                  group={node}
                  path={at}
                  onChange={onChange}
                  catalog={catalog}
                  labels={labels}
                  users={users}
                  errors={errors}
                  isDisabled={isDisabled}
                />
              ) : (
                <SegmentRuleRow
                  rule={node}
                  path={at}
                  group={group}
                  catalog={catalog}
                  labels={labels}
                  users={users}
                  error={errorFor(errors, at)}
                  isDisabled={isDisabled}
                  onChange={(r) => onChange(replaceAt(root, path, withRuleChanged(group, i, r)))}
                  onRemove={() => onChange(removeRule(root, at))}
                />
              )}
            </FlexItem>
          );
        })}
      </Flex>
    </div>
  );
};

/** The recursive rule builder of a segment, driven by the server's field catalogue (spec C18). */
export const SegmentRuleEditor: React.FunctionComponent<
  TreeProps & { value: SegmentRuleGroup; onChange(next: SegmentRuleGroup): void }
> = ({ value, onChange, catalog, labels, users, errors, isDisabled = false }) => (
  <fieldset disabled={isDisabled} style={PLAIN_FIELDSET}>
    <GroupEditor
      root={value}
      group={value}
      path={[]}
      onChange={onChange}
      catalog={catalog}
      labels={labels}
      users={users}
      errors={errors}
      isDisabled={isDisabled}
    />
  </fieldset>
);
