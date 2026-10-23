import * as React from 'react';
import { Label, MenuToggle, Select, SelectList, SelectOption } from '@patternfly/react-core';
import { PhoneNumber, shown } from '@app/api/phoneNumbers';

/** The numbers the inbox shows: all of the viewer's, or some of them. Guest numbers say how they got there. */
export const NumberFilter: React.FunctionComponent<{
  numbers: PhoneNumber[];
  /** Ids of the selected numbers; empty means all. */
  selected: string[];
  onChange(ids: string[]): void;
}> = ({ numbers, selected, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const all = selected.length === 0;
  const text = all ? 'All numbers' : `${selected.length} of ${numbers.length} numbers`;
  const toggle = (id: string) => {
    // "All" shows every box checked, so a click there unchecks that one number and keeps the rest
    const current = all ? numbers.map((n) => n.id) : selected;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    // selecting every number is the same as selecting none: show all, store nothing
    onChange(next.length === numbers.length ? [] : next);
  };
  return (
    <Select
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={(_e, value) => value !== undefined && toggle(String(value))}
      selected={selected}
      toggle={(ref) => (
        <MenuToggle ref={ref} isExpanded={open} onClick={() => setOpen(!open)}>
          {text}
        </MenuToggle>
      )}
    >
      <SelectList aria-label="Numbers">
        {numbers.map((n) => (
          <SelectOption key={n.id} value={n.id} hasCheckbox isSelected={all || selected.includes(n.id)}>
            {shown(n.number)}
            {n.label ? ` · ${n.label}` : ''}
            {n.guest && (
              <>
                {' '}
                <Label isCompact color="grey">
                  via transfer
                </Label>
              </>
            )}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
