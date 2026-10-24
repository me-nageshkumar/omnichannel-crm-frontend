import * as React from 'react';
import { Alert, Button, Spinner, Switch, Tab, TabTitleText, Tabs, Tooltip } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { GripVerticalIcon } from '@patternfly/react-icons';
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
import { deleteField, listFields, reorderFields, updateField } from '@app/api/crm';
import type { FieldDefinition, FieldEntityType } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { crmMessage } from '@app/Crm/errors';
import { FIELD_TYPES, FieldFormModal } from '@app/Crm/Settings/FieldFormModal';
import { invalidateFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';

export const FIELD_ENTITIES: { entity: FieldEntityType; title: string }[] = [
  { entity: 'CONTACT', title: 'Contact' },
  { entity: 'COMPANY', title: 'Company' },
  { entity: 'DEAL', title: 'Deal' },
];

const typeLabel = (f: FieldDefinition) => FIELD_TYPES.find((t) => t.type === f.type)?.label ?? f.type;

const FieldRow: React.FunctionComponent<{
  field: FieldDefinition;
  index: number;
  canManage: boolean;
  busy: boolean;
  onEdit(): void;
  onActive(active: boolean): void;
}> = ({ field, index, canManage, busy, onEdit, onActive }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: !canManage,
  });
  return (
    <Tr
      ref={setNodeRef}
      data-field-index={index}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
        opacity: field.active ? 1 : 0.6,
      }}
    >
      <Td>
        {canManage && (
          <Button
            variant="plain"
            {...attributes}
            {...listeners}
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${field.label}`}
            icon={<GripVerticalIcon />}
            style={{ touchAction: 'none' }}
          />
        )}
      </Td>
      <Td dataLabel="Label">{field.label}</Td>
      <Td dataLabel="Key">
        <code>{field.key}</code>
      </Td>
      <Td dataLabel="Type">{typeLabel(field)}</Td>
      <Td dataLabel="Required">{field.required ? 'Yes' : 'No'}</Td>
      <Td dataLabel="In list">{field.showInList ? 'Yes' : 'No'}</Td>
      <Td dataLabel="On card">{field.showInCard ? 'Yes' : 'No'}</Td>
      <Td dataLabel="Active">
        <Switch
          id={`crm-field-active-${field.id}`}
          aria-label={`${field.label} active`}
          isChecked={field.active}
          isDisabled={!canManage || busy}
          onChange={(_e, v) => onActive(v)}
        />
      </Td>
      <Td isActionCell>
        <Button
          variant="secondary"
          size="sm"
          aria-label={`${canManage ? 'Edit' : 'View'} ${field.label}`}
          onClick={onEdit}
        >
          {canManage ? 'Edit' : 'View'}
        </Button>
      </Td>
    </Tr>
  );
};

/** The custom fields of one record type: list, order, switch on and off, add and edit. */
const EntityFields: React.FunctionComponent<{ entity: FieldEntityType; canManage: boolean }> = ({
  entity,
  canManage,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const loaded = useLoad((t) => listFields(t, ws, entity, true), [ws, entity]);
  const action = useAction();
  const [editing, setEditing] = React.useState<{ field?: FieldDefinition } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fields = (loaded.data ?? []).filter((f) => f.entityType === entity).sort((a, b) => a.position - b.position);
  const active = fields.filter((f) => f.active).length;
  const max = status?.limits.maxCustomFields ?? null;
  const atLimit = max !== null && active >= max;

  const onDragEnd = async ({ active: moved, over }: DragEndEvent) => {
    if (!over || moved.id === over.id) return;
    const from = fields.findIndex((f) => f.id === moved.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(fields, from, to).map((f, i) => ({ ...f, position: i }));
    loaded.setData((all) => [...(all ?? []).filter((f) => f.entityType !== entity), ...next]);
    const ok = await action.run(
      async () => {
        await reorderFields(
          token as string,
          ws,
          entity,
          next.map((f) => f.id),
        );
        return true;
      },
      (e) => crmMessage(e, 'Could not save the new order. Try again.'),
    );
    if (!ok) loaded.reload();
    invalidateFieldDefinitions(ws);
  };

  const setActive = async (f: FieldDefinition, on: boolean) => {
    const ok = await action.run(
      async () => {
        if (on) {
          await updateField(token as string, ws, f.id, {
            entityType: f.entityType,
            key: f.key,
            label: f.label,
            type: f.type,
            active: true,
            version: f.version,
          });
        } else {
          await deleteField(token as string, ws, f.id);
        }
        return true;
      },
      (e) =>
        crmMessage(e, on ? 'Could not switch the field on. Try again.' : 'Could not switch the field off. Try again.'),
    );
    if (ok) {
      loaded.reload();
      invalidateFieldDefinitions(ws);
    }
  };

  const addButton = (
    <Button variant="primary" isAriaDisabled={atLimit} onClick={() => !atLimit && setEditing({})}>
      Add field
    </Button>
  );

  return (
    <>
      <div
        className="pf-v6-u-my-md"
        style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--md)', alignItems: 'center' }}
      >
        {canManage &&
          (atLimit ? (
            <Tooltip content={`Your plan allows ${max} fields per record type`}>{addButton}</Tooltip>
          ) : (
            addButton
          ))}
        {max !== null && (
          <span className="pf-v6-u-color-200" aria-label="Active fields">
            {active} / {max}
          </span>
        )}
      </div>
      {(loaded.error || action.error) && (
        <Alert variant="danger" isInline title={loaded.error ?? action.error} className="pf-v6-u-mb-md" />
      )}
      {loaded.loading && !loaded.data ? (
        <Spinner aria-label="Loading fields" />
      ) : fields.length === 0 ? (
        <p className="pf-v6-u-color-200">No custom fields yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <Table aria-label="Custom fields" variant="compact">
              <Thead>
                <Tr>
                  <Th screenReaderText="Order" />
                  <Th>Label</Th>
                  <Th>Key</Th>
                  <Th>Type</Th>
                  <Th>Required</Th>
                  <Th>In list</Th>
                  <Th>On card</Th>
                  <Th>Active</Th>
                  <Th screenReaderText="Actions" />
                </Tr>
              </Thead>
              <Tbody>
                {fields.map((f, i) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    index={i}
                    canManage={canManage}
                    busy={action.busy}
                    onEdit={() => setEditing({ field: f })}
                    onActive={(on) => void setActive(f, on)}
                  />
                ))}
              </Tbody>
            </Table>
          </SortableContext>
        </DndContext>
      )}
      {editing && (
        <FieldFormModal
          entity={entity}
          field={editing.field}
          readOnly={!canManage}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loaded.reload();
            invalidateFieldDefinitions(ws);
          }}
        />
      )}
    </>
  );
};

/** Settings → Fields: one tab per record type. */
export const FieldsSettings: React.FunctionComponent<{ canManage: boolean }> = ({ canManage }) => {
  const [entity, setEntity] = React.useState<string | number>('CONTACT');
  return (
    <Tabs
      isSubtab
      activeKey={entity}
      onSelect={(_e, k) => setEntity(k)}
      aria-label="Record type"
      className="pf-v6-u-mt-md"
      mountOnEnter
      unmountOnExit
    >
      {FIELD_ENTITIES.map((e) => (
        <Tab key={e.entity} eventKey={e.entity} title={<TabTitleText>{e.title}</TabTitleText>}>
          <EntityFields entity={e.entity} canManage={canManage} />
        </Tab>
      ))}
    </Tabs>
  );
};
