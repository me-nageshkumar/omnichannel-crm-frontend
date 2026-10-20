import * as React from 'react';
import {
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
} from '@patternfly/react-core';

export interface TypeaheadOption {
  value: string;
  description?: string;
}

/**
 * A text field that suggests options as you type but accepts any value. {@code onPick} fires only
 * when a listed option is chosen; typing fires {@code onChange}.
 */
export const Typeahead: React.FunctionComponent<{
  id: string;
  label: string;
  value: string;
  options: TypeaheadOption[];
  onChange(value: string): void;
  onPick(value: string): void;
  validated?: 'error' | 'default';
}> = ({ id, label, value, options, onChange, onPick }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const q = value.trim().toLowerCase();
  const shown = options.filter((o) => o.value.toLowerCase().includes(q) && o.value !== value);
  const open = isOpen && shown.length > 0;

  return (
    <Select
      id={`${id}-select`}
      isOpen={open}
      selected={value}
      onSelect={(_e, v) => {
        onPick(String(v));
        setIsOpen(false);
      }}
      onOpenChange={setIsOpen}
      shouldFocusFirstItemOnOpen={false}
      popperProps={{ appendTo: 'inline' }}
      toggle={(ref) => (
        <MenuToggle ref={ref} variant="typeahead" isFullWidth isExpanded={open} onClick={() => setIsOpen(!isOpen)}>
          <TextInputGroup isPlain>
            <TextInputGroupMain
              inputId={id}
              value={value}
              onClick={() => setIsOpen(true)}
              onChange={(_e, v) => {
                onChange(v);
                setIsOpen(true);
              }}
              autoComplete="off"
              role="combobox"
              isExpanded={open}
              aria-controls={`${id}-listbox`}
              inputProps={{ 'aria-label': label }}
            />
          </TextInputGroup>
        </MenuToggle>
      )}
    >
      <SelectList id={`${id}-listbox`}>
        {shown.map((o) => (
          <SelectOption key={o.value} value={o.value} description={o.description}>
            {o.value}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
