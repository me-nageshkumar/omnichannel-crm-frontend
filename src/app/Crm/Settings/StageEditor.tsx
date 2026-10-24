import * as React from 'react';
import { Button, FormGroup, FormSelect, FormSelectOption, Label, TextInput } from '@patternfly/react-core';
import { GripVerticalIcon, PlusCircleIcon, TimesIcon, UndoIcon } from '@patternfly/react-icons';
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
import type { Stage, StageInput, StageType } from '@app/api/crm';
import { LANE_COLOR_OPTIONS, nextLaneColor } from '@app/Crm/Settings/laneColors';

/** One lane as edited. Numbers are text while typing; {@code removed} lanes stay visible so the removal can be undone. */
export interface StageDraft {
  /** Stable for the row: the stage id, or a client-made key for a new lane. */
  key: string;
  id?: string;
  name: string;
  color: string | null;
  type: StageType;
  probability: string;
  wipLimit: string;
  removed: boolean;
}

export const MAX_LANES = 30;

const TYPE_LABELS: Record<StageType, string> = { OPEN: 'Open', WON: 'Won', LOST: 'Lost' };

export const toDrafts = (stages: Stage[]): StageDraft[] =>
  stages.map((s) => ({
    key: s.id,
    id: s.id,
    name: s.name,
    color: s.color,
    type: s.type,
    probability: String(s.probability),
    wipLimit: s.wipLimit == null ? '' : String(s.wipLimit),
    removed: false,
  }));

let newKeys = 0;
export const newDraft = (position: number, type: StageType = 'OPEN', name = ''): StageDraft => ({
  key: `new-${++newKeys}`,
  name,
  color: nextLaneColor(position),
  type,
  probability: type === 'WON' ? '100' : '0',
  wipLimit: '',
  removed: false,
});

const asInput = (d: StageDraft): StageInput => ({
  ...(d.id ? { id: d.id } : {}),
  name: d.name.trim(),
  color: d.color,
  probability: d.probability.trim() === '' ? 0 : Number(d.probability),
  type: d.type,
  wipLimit: d.wipLimit.trim() === '' ? null : Number(d.wipLimit),
});

/**
 * The lanes as sent, in editor order. Removed lanes are left out, except those named in {@code moves}
 * ({@code stage id -> id of the lane that takes its deals}), which are sent with {@code moveToStageId}.
 */
export function toInputs(drafts: StageDraft[], moves: Record<string, string> = {}): StageInput[] {
  const kept = drafts.filter((d) => !d.removed).map(asInput);
  const moved = drafts
    .filter((d) => d.removed && d.id && moves[d.id])
    .map((d) => ({ ...asInput(d), moveToStageId: moves[d.id as string] }));
  return [...kept, ...moved];
}

const Swatch: React.FunctionComponent<{ hex: string; selected?: boolean }> = ({ hex, selected }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 'var(--pf-t--global--icon--size--md)',
      height: 'var(--pf-t--global--icon--size--md)',
      borderRadius: 'var(--pf-t--global--border--radius--pill)',
      background: hex,
      outline: selected ? '2px solid var(--pf-t--global--border--color--clicked)' : 'none',
      outlineOffset: 2,
    }}
  />
);

const LaneRow: React.FunctionComponent<{
  draft: StageDraft;
  index: number;
  readOnly?: boolean;
  onChange(patch: Partial<StageDraft>): void;
  onRemove(): void;
}> = ({ draft, index, readOnly, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: draft.key,
    disabled: readOnly || draft.removed,
  });
  const id = (f: string) => `${draft.key}-${f}`;
  const locked = readOnly || draft.removed;
  const label = draft.name.trim() || `lane ${index + 1}`;
  return (
    <li
      ref={setNodeRef}
      data-lane-index={index}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        listStyle: 'none',
        opacity: draft.removed ? 0.6 : 1,
        zIndex: isDragging ? 1 : undefined,
        position: 'relative',
        background: 'var(--pf-t--global--background--color--secondary--default)',
        border: 'var(--pf-t--global--border--width--regular) solid var(--pf-t--global--border--color--default)',
        borderRadius: 'var(--pf-t--global--border--radius--small)',
        padding: 'var(--pf-t--global--spacer--sm)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--pf-t--global--spacer--sm)',
        alignItems: 'flex-end',
      }}
    >
      {!readOnly && (
        <Button
          variant="plain"
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
          isDisabled={draft.removed}
          aria-label={`Reorder lane ${label}`}
          icon={<GripVerticalIcon />}
          style={{ touchAction: 'none' }}
        />
      )}
      <div
        role="radiogroup"
        aria-label={`Colour of ${label}`}
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 140 }}
      >
        {LANE_COLOR_OPTIONS.map((c) => (
          <Button
            key={c.hex}
            variant="plain"
            role="radio"
            aria-checked={draft.color === c.hex}
            aria-label={c.name}
            isDisabled={locked}
            onClick={() => onChange({ color: c.hex })}
            style={{ padding: 4, minWidth: 0 }}
            icon={<Swatch hex={c.hex} selected={draft.color === c.hex} />}
          />
        ))}
      </div>
      <FormGroup label="Lane name" fieldId={id('name')} style={{ flex: '1 1 160px' }}>
        <TextInput id={id('name')} value={draft.name} isDisabled={locked} onChange={(_e, v) => onChange({ name: v })} />
      </FormGroup>
      <FormGroup label="Lane type" fieldId={id('type')} style={{ flex: '0 1 110px' }}>
        <FormSelect
          id={id('type')}
          value={draft.type}
          isDisabled={locked}
          onChange={(_e, v) => {
            const type = v as StageType;
            onChange({
              type,
              ...(type === 'WON' ? { probability: '100' } : type === 'LOST' ? { probability: '0' } : {}),
            });
          }}
        >
          {(Object.keys(TYPE_LABELS) as StageType[]).map((t) => (
            <FormSelectOption key={t} value={t} label={TYPE_LABELS[t]} />
          ))}
        </FormSelect>
      </FormGroup>
      <FormGroup label="Probability (%)" fieldId={id('prob')} style={{ flex: '0 1 100px' }}>
        <TextInput
          id={id('prob')}
          type="number"
          min={0}
          max={100}
          value={draft.probability}
          isDisabled={locked}
          onChange={(_e, v) => onChange({ probability: v })}
        />
      </FormGroup>
      <FormGroup label="WIP limit" fieldId={id('wip')} style={{ flex: '0 1 90px' }}>
        <TextInput
          id={id('wip')}
          type="number"
          min={0}
          value={draft.wipLimit}
          isDisabled={locked}
          onChange={(_e, v) => onChange({ wipLimit: v })}
        />
      </FormGroup>
      {!readOnly &&
        (draft.removed ? (
          <>
            <Label color="red" isCompact>
              Will be removed
            </Label>
            <Button variant="link" icon={<UndoIcon />} onClick={() => onChange({ removed: false })}>
              Restore
            </Button>
          </>
        ) : (
          <Button variant="plain" aria-label={`Remove lane ${label}`} icon={<TimesIcon />} onClick={onRemove} />
        ))}
    </li>
  );
};

/** The lanes of a pipeline: drag (or keyboard) to reorder, edit in place, add and remove. */
export const StageEditor: React.FunctionComponent<{
  stages: StageDraft[];
  onChange(next: StageDraft[]): void;
  readOnly?: boolean;
}> = ({ stages, onChange, readOnly }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const patch = (key: string, p: Partial<StageDraft>) =>
    onChange(stages.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const remove = (d: StageDraft) =>
    onChange(
      d.id ? stages.map((s) => (s.key === d.key ? { ...s, removed: true } : s)) : stages.filter((s) => s.key !== d.key),
    );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = stages.findIndex((s) => s.key === active.id);
    const to = stages.findIndex((s) => s.key === over.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(stages, from, to));
  };
  const active = stages.filter((s) => !s.removed).length;

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stages.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          <ol
            aria-label="Lanes"
            style={{
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--pf-t--global--spacer--sm)',
            }}
          >
            {stages.map((d, i) => (
              <LaneRow
                key={d.key}
                draft={d}
                index={i}
                readOnly={readOnly}
                onChange={(p) => patch(d.key, p)}
                onRemove={() => remove(d)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!readOnly && (
        <Button
          variant="link"
          icon={<PlusCircleIcon />}
          isDisabled={active >= MAX_LANES}
          onClick={() => onChange([...stages, newDraft(stages.length)])}
          className="pf-v6-u-mt-sm"
        >
          Add lane
        </Button>
      )}
    </div>
  );
};
