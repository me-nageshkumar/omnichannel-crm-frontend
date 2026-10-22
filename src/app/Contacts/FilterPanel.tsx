import * as React from 'react';
import {
  Badge,
  Button,
  Checkbox,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';
import {
  AttributeCondition,
  AttributeOp,
  ContactAttribute,
  ContactFilterSpec,
  ContactLabel,
  ContactSource,
  SOURCES,
} from '@app/api/contacts';
import { SOURCE_TEXT } from '@app/Contacts/contactDisplay';
import { cleanSpec, dayEnd, dayOf, dayStart } from '@app/Contacts/filterSpec';

const OPS: Record<AttributeOp, string> = {
  EQUALS: 'is',
  CONTAINS: 'contains',
  EXISTS: 'has a value',
  NOT_EXISTS: 'is empty',
};

const isComplete = (r: AttributeCondition) =>
  !!r.attributeId && (r.op === 'EXISTS' || r.op === 'NOT_EXISTS' || !!r.value?.trim());

type LabelKey = 'labelsAny' | 'labelsAll' | 'labelsNone';

/** A checkbox menu of labels; with max, the unselected labels are disabled once max are chosen. */
export const LabelPicker: React.FunctionComponent<{
  title: string;
  labels: ContactLabel[];
  selected: string[];
  onChange(ids: string[]): void;
  max?: number;
}> = ({ title, labels, selected, onChange, max }) => {
  const full = max !== undefined && selected.length >= max;
  const [open, setOpen] = React.useState(false);
  return (
    <Select
      role="menu"
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={(_e, v) =>
        onChange(selected.includes(v as string) ? selected.filter((x) => x !== v) : [...selected, v as string])
      }
      toggle={(ref) => (
        <MenuToggle ref={ref} isExpanded={open} onClick={() => setOpen(!open)}>
          {title} {selected.length > 0 && <Badge isRead>{selected.length}</Badge>}
        </MenuToggle>
      )}
    >
      <SelectList>
        {labels.map((l) => (
          <SelectOption
            key={l.id}
            value={l.id}
            hasCheckbox
            isSelected={selected.includes(l.id)}
            isDisabled={full && !selected.includes(l.id)}
          >
            {l.name}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};

/** The structured filter: labels any/all/none, attribute conditions, source, hidden number, dates. */
export const FilterPanel: React.FunctionComponent<{
  spec: ContactFilterSpec;
  labels: ContactLabel[];
  attributes: ContactAttribute[];
  onChange(spec: ContactFilterSpec): void;
}> = ({ spec, labels, attributes, onChange }) => {
  const set = (patch: Partial<ContactFilterSpec>) => onChange(cleanSpec({ ...spec, ...patch }));
  const conditions = spec.attributes ?? [];
  // A row that was just added has no attribute yet; keep it in the panel but out of the sent filter.
  const [draft, setDraft] = React.useState<AttributeCondition[]>(conditions);
  // Only complete rows are sent; typing a value waits 300 ms like the search box.
  const latestSet = React.useRef(set);
  latestSet.current = set;
  const sentRef = React.useRef(conditions);
  sentRef.current = conditions;
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const setRows = (rows: AttributeCondition[], debounce = false) => {
    setDraft(rows);
    clearTimeout(timer.current);
    const send = () => {
      const complete = rows.filter(isComplete);
      // Nothing the server would see has changed, so do not trigger another search.
      if (JSON.stringify(complete) !== JSON.stringify(sentRef.current)) latestSet.current({ attributes: complete });
    };
    if (debounce) timer.current = setTimeout(send, 300);
    else send();
  };
  const patchRow = (i: number, patch: Partial<AttributeCondition>) =>
    setRows(
      draft.map((r, j) => (j === i ? { ...r, ...patch } : r)),
      'value' in patch && patch.value !== undefined,
    );
  const toggleSource = (s: ContactSource, on: boolean) =>
    set({ source: on ? [...(spec.source ?? []), s] : (spec.source ?? []).filter((x) => x !== s) });

  const pickers: Array<[LabelKey, string]> = [
    ['labelsAny', 'Any of these labels'],
    ['labelsAll', 'All of these labels'],
    ['labelsNone', 'None of these labels'],
  ];
  const dates: Array<[string, 'createdFrom' | 'createdTo' | 'lastMessageFrom' | 'lastMessageTo', boolean]> = [
    ['Created from', 'createdFrom', false],
    ['Created to', 'createdTo', true],
    ['Last message from', 'lastMessageFrom', false],
    ['Last message to', 'lastMessageTo', true],
  ];

  return (
    <Grid hasGutter>
      {pickers.map(([key, title]) => (
        <GridItem key={key} md={4}>
          <LabelPicker
            title={title}
            labels={labels}
            selected={spec[key] ?? []}
            onChange={(ids) => set({ [key]: ids })}
          />
        </GridItem>
      ))}
      <GridItem span={12}>
        {draft.map((row, i) => (
          <div key={i}>
            <FormSelect
              aria-label="Attribute"
              value={row.attributeId}
              onChange={(_e, v) => patchRow(i, { attributeId: v })}
            >
              <FormSelectOption value="" label="Choose attribute" isPlaceholder />
              {attributes.map((a) => (
                <FormSelectOption key={a.id} value={a.id} label={a.name} />
              ))}
            </FormSelect>
            <FormSelect
              aria-label="Condition"
              value={row.op}
              onChange={(_e, v) => patchRow(i, { op: v as AttributeOp, value: undefined })}
            >
              {(Object.keys(OPS) as AttributeOp[]).map((op) => (
                <FormSelectOption key={op} value={op} label={OPS[op]} />
              ))}
            </FormSelect>
            {(row.op === 'EQUALS' || row.op === 'CONTAINS') && (
              <TextInput aria-label="Value" value={row.value ?? ''} onChange={(_e, v) => patchRow(i, { value: v })} />
            )}
            <Button
              variant="plain"
              aria-label="Remove condition"
              onClick={() => setRows(draft.filter((_r, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="link"
          isInline
          onClick={() => setDraft([...draft, { attributeId: '', op: 'EQUALS' }])}
          isDisabled={attributes.length === 0}
        >
          Add attribute condition
        </Button>
      </GridItem>
      <GridItem span={12}>
        <FormGroup role="group" label="Source" isInline>
          {SOURCES.map((s) => (
            <Checkbox
              key={s}
              id={`filter-source-${s}`}
              label={SOURCE_TEXT[s]}
              isChecked={(spec.source ?? []).includes(s)}
              onChange={(_e, on) => toggleSource(s, on)}
            />
          ))}
          <Checkbox
            id="filter-hidden"
            label="Number hidden only"
            isChecked={spec.numberHidden === true}
            onChange={(_e, on) => set({ numberHidden: on ? true : undefined })}
          />
        </FormGroup>
      </GridItem>
      <GridItem md={3}>
        <FormGroup label="Do not contact" fieldId="filter-dnc">
          <FormSelect
            id="filter-dnc"
            value={spec.doNotContact === undefined ? 'any' : String(spec.doNotContact)}
            onChange={(_e, v) => set({ doNotContact: v === 'any' ? undefined : v === 'true' })}
          >
            <FormSelectOption value="any" label="Any" />
            <FormSelectOption value="true" label="Only" />
            <FormSelectOption value="false" label="Exclude" />
          </FormSelect>
        </FormGroup>
      </GridItem>
      {dates.map(([title, key, end]) => (
        <GridItem key={key} md={3}>
          <FormGroup label={title} fieldId={`filter-${key}`}>
            <TextInput
              id={`filter-${key}`}
              type="date"
              value={dayOf(spec[key])}
              onChange={(_e, v) => set({ [key]: end ? dayEnd(v) : dayStart(v) })}
            />
          </FormGroup>
        </GridItem>
      ))}
    </Grid>
  );
};
