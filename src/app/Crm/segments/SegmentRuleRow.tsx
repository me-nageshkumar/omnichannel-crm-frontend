import * as React from 'react';
import {
  Button,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  FormSelectOptionGroup,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import type { ContactLabel } from '@app/api/contacts';
import type { SegmentFieldCatalog, SegmentFieldOption, SegmentRule, SegmentRuleGroup } from '@app/api/crm';
import type { FieldUser } from '@app/Crm/common/fields/types';
import {
  OPERATOR_LABELS,
  type Path,
  fieldByKey,
  isFlagged,
  nodeName,
  pipelineOfGroup,
  rulePath,
  valueKind,
  withField,
  withOperator,
} from '@app/Crm/segments/segmentModel';
import { SegmentValueEditor } from '@app/Crm/segments/SegmentValueEditor';

export const MISSING_TEXT = 'This field no longer exists';
export const INACCESSIBLE_TEXT = "A pipeline you can't access";
export const STAGE_HINT = 'Add a pipeline rule to this group first';

/** One rule: field (grouped by the catalogue), operator, a value control that follows both, and Remove. */
export const SegmentRuleRow: React.FunctionComponent<{
  rule: SegmentRule;
  path: Path;
  /** The group holding the rule: a stage rule reads its pipeline from it. */
  group: SegmentRuleGroup;
  catalog: SegmentFieldCatalog;
  labels: ContactLabel[];
  users: FieldUser[];
  error?: string;
  isDisabled?: boolean;
  onChange(rule: SegmentRule): void;
  onRemove(): void;
}> = ({ rule, path, group, catalog, labels, users, error, isDisabled = false, onChange, onRemove }) => {
  const id = rulePath(path);
  const spec = fieldByKey(catalog, rule.field);
  const flagged = isFlagged(rule);
  const locked = isDisabled || flagged;
  const kind = spec ? valueKind(spec.type, rule.operator) : 'none';
  let options: SegmentFieldOption[] = spec?.options ?? [];
  let stageHint: string | null = null;
  if (spec?.dependsOn) {
    const parent = pipelineOfGroup(group);
    options = parent ? (spec.optionsByParent?.[parent] ?? []) : [];
    if (!parent) stageHint = STAGE_HINT;
  }
  return (
    <div role="group" aria-label={nodeName(path, false)}>
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <FormSelect
            aria-label="Field"
            value={rule.field}
            isDisabled={locked}
            onChange={(_e, v) => onChange(withField(rule, v, catalog))}
          >
            <FormSelectOption value="" label="Choose a field" isPlaceholder />
            {flagged && (
              <FormSelectOption
                value={rule.field}
                label={`${rule.field} (${rule.missing ? 'missing' : 'inaccessible'})`}
                isDisabled
              />
            )}
            {catalog.groups.map((g) => (
              <FormSelectOptionGroup key={g.key} label={g.label}>
                {g.fields.map((f) => (
                  <FormSelectOption key={f.key} value={f.key} label={f.label} />
                ))}
              </FormSelectOptionGroup>
            ))}
          </FormSelect>
        </FlexItem>
        <FlexItem>
          <FormSelect
            aria-label="Operator"
            value={rule.operator}
            isDisabled={!spec || locked}
            onChange={(_e, v) => spec && onChange(withOperator(rule, v, spec.type))}
          >
            {(spec?.operators ?? []).map((op) => (
              <FormSelectOption key={op} value={op} label={OPERATOR_LABELS[op] ?? op} />
            ))}
          </FormSelect>
        </FlexItem>
        {spec && !flagged && (
          <FlexItem>
            <SegmentValueEditor
              id={id}
              kind={kind}
              field={spec}
              options={options}
              value={rule.value}
              labels={labels}
              users={users}
              isDisabled={locked || stageHint !== null}
              onChange={(value) => onChange({ ...rule, value })}
            />
          </FlexItem>
        )}
        <FlexItem>
          <Button
            variant="plain"
            aria-label="Remove rule"
            icon={<TimesIcon />}
            onClick={onRemove}
            isDisabled={isDisabled}
          />
        </FlexItem>
      </Flex>
      {(flagged || stageHint || error) && (
        <HelperText>
          {rule.missing && <HelperTextItem variant="warning">{MISSING_TEXT}</HelperTextItem>}
          {rule.inaccessible && <HelperTextItem variant="warning">{INACCESSIBLE_TEXT}</HelperTextItem>}
          {stageHint && <HelperTextItem>{stageHint}</HelperTextItem>}
          {error && <HelperTextItem variant="error">{error}</HelperTextItem>}
        </HelperText>
      )}
    </div>
  );
};
