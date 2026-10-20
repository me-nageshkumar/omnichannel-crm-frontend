import * as React from 'react';
import { Button, MenuToggle, Select, SelectList, SelectOption } from '@patternfly/react-core';
import type { SavedFilter } from '@app/api/contacts';

/** Picks a saved filter; people with contact:bulk can also save the current one or delete the picked one. */
export const SavedFilterBar: React.FunctionComponent<{
  filters: SavedFilter[];
  selectedId: string | null;
  canManage: boolean;
  canSaveCurrent: boolean;
  onSelect(id: string | null): void;
  onSave(): void;
  onDelete(): void;
}> = ({ filters, selectedId, canManage, canSaveCurrent, onSelect, onSave, onDelete }) => {
  const [open, setOpen] = React.useState(false);
  const picked = filters.find((f) => f.id === selectedId);
  return (
    <>
      <Select
        isOpen={open}
        selected={selectedId ?? 'none'}
        onSelect={(_e, v) => {
          onSelect(v === 'none' ? null : (v as string));
          setOpen(false);
        }}
        onOpenChange={setOpen}
        toggle={(ref) => (
          <MenuToggle ref={ref} isExpanded={open} onClick={() => setOpen(!open)}>
            {`Saved filter: ${picked?.name ?? 'None'}`}
          </MenuToggle>
        )}
      >
        <SelectList>
          <SelectOption value="none">None</SelectOption>
          {filters.map((f) => (
            <SelectOption key={f.id} value={f.id}>
              {f.name}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
      {canManage && (
        <>
          <Button variant="secondary" onClick={onSave} isDisabled={!canSaveCurrent}>
            Save filter
          </Button>
          {picked && (
            <Button variant="link" isDanger onClick={onDelete}>
              Delete filter
            </Button>
          )}
        </>
      )}
    </>
  );
};
