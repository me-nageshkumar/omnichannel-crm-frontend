import * as React from 'react';
import {
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
} from '@patternfly/react-core';

/** A typeahead over the brand's existing categories that also accepts a new one. */
export const CategoryField: React.FunctionComponent<{
  id: string;
  value: string;
  options: string[];
  disabled: boolean;
  invalid: boolean;
  onChange(value: string): void;
}> = ({ id, value, options, disabled, invalid, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const needle = value.trim().toLowerCase();
  const shown = options.filter((o) => o.toLowerCase().includes(needle));
  return (
    <Select
      isOpen={open && shown.length > 0}
      selected={value}
      onSelect={(_e, v) => {
        onChange(String(v));
        setOpen(false);
      }}
      onOpenChange={setOpen}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          variant="typeahead"
          isFullWidth
          isDisabled={disabled}
          isExpanded={open && shown.length > 0}
          onClick={() => setOpen(!open)}
        >
          <TextInputGroup isPlain isDisabled={disabled}>
            <TextInputGroupMain
              id={id}
              aria-label="Category"
              role="combobox"
              autoComplete="off"
              placeholder="Pick or type a category"
              value={value}
              isExpanded={open && shown.length > 0}
              onChange={(_e, v) => {
                onChange(v);
                setOpen(true);
              }}
              onClick={() => setOpen(true)}
              {...(invalid ? { 'aria-invalid': true } : {})}
            />
          </TextInputGroup>
        </MenuToggle>
      )}
    >
      <SelectList>
        {shown.map((o) => (
          <SelectOption key={o} value={o}>
            {o}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
