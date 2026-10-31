import * as React from 'react';
import { Checkbox, Flex, FormSelect, FormSelectOption, Label, LabelGroup, TextInput } from '@patternfly/react-core';
import type { ContactLabel } from '@app/api/contacts';
import { getCompany } from '@app/api/crm';
import type { Ref, SegmentFieldOption, SegmentRule } from '@app/api/crm';
import { LabelPicker } from '@app/Contacts/FilterPanel';
import { CompanyTypeahead } from '@app/Crm/Companies/CompanyTypeahead';
import type { FieldUser } from '@app/Crm/common/fields/types';
import { MAX_DAYS, MAX_VALUES, MAX_VALUE_LENGTH, type ValueKind } from '@app/Crm/segments/segmentModel';
import { useSession } from '@app/session/SessionContext';

const UNKNOWN_COMPANY = 'Unknown company';

/**
 * The names of the company ids a rule stores: each is read once, and one that cannot be read (usually deleted) gets a
 * label rather than its id. {@code remember} keeps a name already in hand, so a picked company needs no read.
 */
function useCompanyNames(ids: string[]) {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [names, setNames] = React.useState<Record<string, string>>({});
  const asked = React.useRef(new Set<string>());
  const wanted = ids.filter((id) => id !== '').join('\n');

  React.useEffect(() => {
    if (!token || !wanted) return;
    for (const id of wanted.split('\n')) {
      if (asked.current.has(id)) continue;
      asked.current.add(id);
      getCompany(token, ws, id).then(
        (company) => setNames((cur) => ({ ...cur, [id]: company.name })),
        () => setNames((cur) => ({ ...cur, [id]: UNKNOWN_COMPANY })),
      );
    }
  }, [token, ws, wanted]);

  return {
    nameOf: (id: string) => names[id] ?? 'Loading…',
    remember: (ref: Ref) => {
      asked.current.add(ref.id);
      setNames((cur) => ({ ...cur, [ref.id]: ref.name ?? UNKNOWN_COMPANY }));
    },
  };
}

/** The value control of one rule, by the kind its field and operator take. */
export const SegmentValueEditor: React.FunctionComponent<{
  id: string;
  kind: ValueKind;
  /** The field's options for this rule (a stage's come from its group's pipeline). */
  options: SegmentFieldOption[];
  value: SegmentRule['value'];
  labels: ContactLabel[];
  users: FieldUser[];
  isDisabled?: boolean;
  onChange(value: SegmentRule['value']): void;
}> = ({ id, kind, options, value, labels, users, isDisabled = false, onChange }) => {
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : [];
  const companies = useCompanyNames(kind === 'company' ? [text] : kind === 'companies' ? list : []);
  switch (kind) {
    case 'none':
      return null;
    case 'text':
      return (
        <TextInput
          aria-label="Value"
          value={text}
          maxLength={MAX_VALUE_LENGTH}
          isDisabled={isDisabled}
          onChange={(_e, v) => onChange(v)}
        />
      );
    case 'number':
      return (
        <TextInput
          type="number"
          aria-label="Value"
          value={text}
          isDisabled={isDisabled}
          onChange={(_e, v) => onChange(v)}
        />
      );
    case 'days':
      return (
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <TextInput
            type="number"
            min={1}
            max={MAX_DAYS}
            aria-label="Value"
            value={text}
            isDisabled={isDisabled}
            onChange={(_e, v) => onChange(v)}
          />
          <span>days</span>
        </Flex>
      );
    case 'numberRange':
    case 'dateRange': {
      const [from = '', to = ''] = list;
      const type = kind === 'dateRange' ? 'date' : 'number';
      return (
        <>
          <TextInput
            type={type}
            aria-label="From"
            value={from}
            isDisabled={isDisabled}
            onChange={(_e, v) => onChange([v, to])}
          />
          <TextInput
            type={type}
            aria-label="To"
            value={to}
            isDisabled={isDisabled}
            onChange={(_e, v) => onChange([from, v])}
          />
        </>
      );
    }
    case 'date':
      return (
        <TextInput
          type="date"
          aria-label="Value"
          value={text}
          isDisabled={isDisabled}
          onChange={(_e, v) => onChange(v)}
        />
      );
    case 'boolean':
      return (
        <FormSelect aria-label="Value" value={text} isDisabled={isDisabled} onChange={(_e, v) => onChange(v)}>
          <FormSelectOption value="" label="Choose a value" isPlaceholder />
          <FormSelectOption value="true" label="Yes" />
          <FormSelectOption value="false" label="No" />
        </FormSelect>
      );
    case 'option':
      return (
        <FormSelect aria-label="Value" value={text} isDisabled={isDisabled} onChange={(_e, v) => onChange(v)}>
          <FormSelectOption value="" label="Choose a value" isPlaceholder />
          {text !== '' && !options.some((o) => o.value === text) && (
            <FormSelectOption value={text} label="—" isDisabled />
          )}
          {options.map((o) => (
            <FormSelectOption key={o.value} value={o.value} label={o.label} />
          ))}
        </FormSelect>
      );
    case 'options':
      return (
        <Flex role="group" aria-label="Value">
          {options.map((o) => (
            <Checkbox
              key={o.value}
              id={`${id}-${o.value}`}
              label={o.label}
              isChecked={list.includes(o.value)}
              isDisabled={isDisabled || (!list.includes(o.value) && list.length >= MAX_VALUES)}
              onChange={(_e, on) => onChange(on ? [...list, o.value] : list.filter((x) => x !== o.value))}
            />
          ))}
        </Flex>
      );
    case 'user':
      return (
        <FormSelect aria-label="Value" value={text} isDisabled={isDisabled} onChange={(_e, v) => onChange(v)}>
          <FormSelectOption value="" label="Choose a person" isPlaceholder />
          {text !== '' && !users.some((u) => u.id === text) && (
            <FormSelectOption value={text} label="Unknown person" isDisabled />
          )}
          {users.map((u) => (
            <FormSelectOption key={u.id} value={u.id} label={u.name} />
          ))}
        </FormSelect>
      );
    case 'users':
      return (
        <Flex role="group" aria-label="Value">
          {users.map((u) => (
            <Checkbox
              key={u.id}
              id={`${id}-${u.id}`}
              label={u.name}
              isChecked={list.includes(u.id)}
              isDisabled={isDisabled}
              onChange={(_e, on) => onChange(on ? [...list, u.id] : list.filter((x) => x !== u.id))}
            />
          ))}
        </Flex>
      );
    case 'company':
      return (
        <CompanyTypeahead
          id={`${id}-company`}
          value={text ? { id: text, name: companies.nameOf(text) } : null}
          onChange={(ref: Ref | null) => {
            if (ref) companies.remember(ref);
            onChange(ref?.id ?? '');
          }}
          canCreate={false}
        />
      );
    case 'companies':
      return (
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <CompanyTypeahead
            id={`${id}-company`}
            value={null}
            onChange={(ref: Ref | null) => {
              if (!ref || list.includes(ref.id) || list.length >= MAX_VALUES) return;
              companies.remember(ref);
              onChange([...list, ref.id]);
            }}
            canCreate={false}
          />
          {list.length > 0 && (
            <LabelGroup aria-label="Chosen companies">
              {list.map((cid) => (
                <Label
                  key={cid}
                  closeBtnAriaLabel={`Remove ${companies.nameOf(cid)}`}
                  onClose={() => onChange(list.filter((x) => x !== cid))}
                >
                  {companies.nameOf(cid)}
                </Label>
              ))}
            </LabelGroup>
          )}
        </Flex>
      );
    case 'label':
      return (
        <FormSelect aria-label="Value" value={text} isDisabled={isDisabled} onChange={(_e, v) => onChange(v)}>
          <FormSelectOption value="" label="Choose a label" isPlaceholder />
          {text !== '' && !labels.some((l) => l.id === text) && <FormSelectOption value={text} label="—" isDisabled />}
          {labels.map((l) => (
            <FormSelectOption key={l.id} value={l.id} label={l.name} />
          ))}
        </FormSelect>
      );
    case 'labels':
      return <LabelPicker title="Choose labels" labels={labels} selected={list} onChange={onChange} max={MAX_VALUES} />;
  }
};
