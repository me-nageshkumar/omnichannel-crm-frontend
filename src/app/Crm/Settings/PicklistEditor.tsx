import * as React from 'react';
import { Button, FormSelect, FormSelectOption, Radio, Switch, TextInput } from '@patternfly/react-core';
import { GripVerticalIcon, PlusCircleIcon, TimesIcon } from '@patternfly/react-icons';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PicklistItem } from '@app/api/crm';
import { LANE_COLOR_OPTIONS } from '@app/Crm/Settings/laneColors';
import { optionKey } from '@app/Crm/Settings/OptionsEditor';

/** A picklist row being edited: the item plus whether the server has it (then its key is fixed). */
export interface PicklistDraft extends PicklistItem {
  uid: string;
  saved: boolean;
}

export const toDrafts = (items: PicklistItem[]): PicklistDraft[] =>
  items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ ...i, uid: i.key, saved: true }));

/** The items to send, in order, positions renumbered. */
export const fromDrafts = (drafts: PicklistDraft[]): PicklistItem[] =>
  drafts.map(({ key, label, color, active, isDefault }, i) => ({
    key,
    label: label.trim(),
    color,
    position: i + 1,
    active,
    isDefault,
  }));

/** A picklist key from a label: starts with a letter, then a-z, 0-9 and _ (at most 40). */
export function picklistKey(label: string, others: PicklistDraft[]): string {
  const base = optionKey(label).replace(/^[^a-z]+/, '') || 'item';
  let key = base;
  for (let n = 2; others.some((o) => o.key === key); n++) key = `${base.slice(0, 37)}_${n}`;
  return key;
}

let seq = 0;

const ItemRow: React.FunctionComponent<{
  list: string;
  item: PicklistDraft;
  index: number;
  readOnly?: boolean;
  onChange(patch: Partial<PicklistDraft>): void;
  onDefault(): void;
  onRemove(): void;
}> = ({ list, item, index, readOnly, onChange, onDefault, onRemove }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
    disabled: readOnly,
  });
  const name = item.label.trim() || `item ${index + 1}`;
  return (
    <li
      ref={setNodeRef}
      data-item-index={index}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        listStyle: 'none',
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--pf-t--global--spacer--sm)',
        opacity: item.active ? 1 : 0.6,
      }}
    >
      {!readOnly && (
        <Button
          variant="plain"
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${name}`}
          icon={<GripVerticalIcon />}
          style={{ touchAction: 'none' }}
        />
      )}
      <FormSelect
        aria-label={`Colour of ${name}`}
        value={item.color ?? ''}
        isDisabled={readOnly}
        onChange={(_e, v) => onChange({ color: v || null })}
        style={{ maxWidth: '8rem' }}
      >
        <FormSelectOption value="" label="No colour" />
        {LANE_COLOR_OPTIONS.map((c) => (
          <FormSelectOption key={c.hex} value={c.hex} label={c.name} />
        ))}
      </FormSelect>
      <TextInput
        aria-label="Item label"
        value={item.label}
        isDisabled={readOnly}
        style={{ minWidth: '10rem', flex: '1 1 10rem' }}
        validated={item.label.trim() ? 'default' : 'error'}
        onChange={(_e, label) => onChange({ label })}
      />
      <span className="pf-v6-u-font-size-sm pf-v6-u-color-200">{item.key ? `Key: ${item.key}` : ''}</span>
      <Switch
        id={`${list}-active-${item.uid}`}
        aria-label={`${name} active`}
        isChecked={item.active}
        isDisabled={readOnly}
        onChange={(_e, active) => onChange(active ? { active } : { active, isDefault: false })}
      />
      <Radio
        id={`${list}-default-${item.uid}`}
        name={`${list}-default`}
        label={
          <>
            <span aria-hidden="true">Default</span>
            <span className="pf-v6-screen-reader">{`Default: ${name}`}</span>
          </>
        }
        isChecked={item.isDefault}
        isDisabled={readOnly || !item.active}
        onChange={onDefault}
      />
      {!readOnly && !item.saved && (
        <Button variant="plain" aria-label={`Remove ${name}`} icon={<TimesIcon />} onClick={onRemove} />
      )}
    </li>
  );
};

/** One settings picklist: drag to reorder, rename, colour, switch off, pick the default; saved items stay. */
export const PicklistEditor: React.FunctionComponent<{
  list: string;
  items: PicklistDraft[];
  onChange(next: PicklistDraft[]): void;
  readOnly?: boolean;
}> = ({ list, items, onChange, readOnly }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const patch = (uid: string, p: Partial<PicklistDraft>) =>
    onChange(
      items.map((i) => {
        if (i.uid !== uid) return i;
        const next = { ...i, ...p };
        // A new item's key follows its label until it is saved.
        if (!i.saved && p.label !== undefined)
          next.key = picklistKey(
            p.label,
            items.filter((x) => x.uid !== uid),
          );
        return next;
      }),
    );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.uid === active.id);
    const to = items.findIndex((i) => i.uid === over.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to));
  };
  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
          <ol style={{ margin: 0, padding: 0, display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}>
            {items.map((item, i) => (
              <ItemRow
                key={item.uid}
                list={list}
                item={item}
                index={i}
                readOnly={readOnly}
                onChange={(p) => patch(item.uid, p)}
                onDefault={() => onChange(items.map((x) => ({ ...x, isDefault: x.uid === item.uid })))}
                onRemove={() => onChange(items.filter((x) => x.uid !== item.uid))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!readOnly && (
        <Button
          variant="link"
          icon={<PlusCircleIcon />}
          className="pf-v6-u-mt-sm"
          onClick={() =>
            onChange([
              ...items,
              {
                uid: `new-${++seq}`,
                key: '',
                label: '',
                color: null,
                position: items.length + 1,
                active: true,
                isDefault: false,
                saved: false,
              },
            ])
          }
        >
          Add item
        </Button>
      )}
    </div>
  );
};
