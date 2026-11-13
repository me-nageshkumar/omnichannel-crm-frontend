import * as React from 'react';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuToggle,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import type { VariableGroup } from '@app/Chatbots/variables';
import { completeAt, insertAt } from '@app/Chatbots/variables';

/**
 * A text field with the run's variables (spec §8.1): an "Insert variable" menu that splices `{{path}}` at the caret,
 * and suggestions while typing after `{{`.
 */
export const VariableInput: React.FunctionComponent<{
  id: string;
  'aria-label': string;
  value: string;
  onChange(next: string): void;
  variables: VariableGroup[];
  isDisabled?: boolean;
  multiline?: boolean;
  rows?: number;
  validated?: 'default' | 'error';
  placeholder?: string;
  maxLength?: number;
}> = ({
  id,
  'aria-label': ariaLabel,
  value,
  onChange,
  variables,
  isDisabled,
  multiline,
  rows = 3,
  validated,
  placeholder,
  maxLength,
}) => {
  const ref = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [menu, setMenu] = React.useState(false);
  const [caret, setCaret] = React.useState<number>(value.length);
  const completion = completeAt(value, caret);
  const suggestions = completion
    ? variables
        .reduce<
          { path: string; hint?: string }[]
        >((acc, g) => acc.concat(g.paths.filter((p) => p.path.toLowerCase().indexOf(completion.query.toLowerCase()) >= 0)), [])
        .slice(0, 8)
    : [];

  const insert = (path: string, start: number, end: number) => {
    const next = insertAt(value, start, end, path);
    onChange(next.text);
    setCaret(next.caret);
    window.setTimeout(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(next.caret, next.caret);
        } catch {
          // inputs of some types refuse selection ranges
        }
      }
    }, 0);
  };
  const fromMenu = (path: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    insert(path, start, end);
    setMenu(false);
  };
  const track = (el: HTMLInputElement | HTMLTextAreaElement) => setCaret(el.selectionStart ?? el.value.length);
  const common = {
    id,
    'aria-label': ariaLabel,
    value,
    isDisabled,
    validated,
    placeholder,
    maxLength,
    onChange: (_e: React.FormEvent, v: string) => onChange(v),
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => track(e.currentTarget),
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => track(e.currentTarget),
  };
  return (
    <div className="omni-variable-input">
      <div className="omni-variable-input__row">
        {multiline ? (
          <TextArea
            {...common}
            rows={rows}
            resizeOrientation="vertical"
            ref={ref as React.RefObject<HTMLTextAreaElement>}
          />
        ) : (
          <TextInput {...common} ref={ref as React.RefObject<HTMLInputElement>} />
        )}
        <Dropdown
          isOpen={menu}
          onOpenChange={setMenu}
          popperProps={{ position: 'right' }}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              variant="secondary"
              size="sm"
              isDisabled={isDisabled}
              isExpanded={menu}
              onClick={() => setMenu((o) => !o)}
              aria-label="Insert variable"
            >
              {'{{ }}'}
            </MenuToggle>
          )}
        >
          <DropdownList>
            {variables.map((g) => (
              <DropdownGroup key={g.label} label={g.label}>
                <DropdownList>
                  {g.paths.map((p) => (
                    <DropdownItem key={p.path} description={p.hint} onClick={() => fromMenu(p.path)}>
                      {`{{${p.path}}}`}
                    </DropdownItem>
                  ))}
                </DropdownList>
              </DropdownGroup>
            ))}
          </DropdownList>
        </Dropdown>
      </div>
      {completion && suggestions.length > 0 && !isDisabled && (
        <Menu
          className="omni-variable-input__suggest"
          role="listbox"
          aria-label="Variable suggestions"
          onSelect={(_e, itemId) => insert(String(itemId), completion.start, caret)}
        >
          <MenuContent>
            <MenuList>
              {suggestions.map((s) => (
                <MenuItem key={s.path} itemId={s.path} description={s.hint}>
                  {`{{${s.path}}}`}
                </MenuItem>
              ))}
            </MenuList>
          </MenuContent>
        </Menu>
      )}
    </div>
  );
};
