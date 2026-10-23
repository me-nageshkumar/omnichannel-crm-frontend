import * as React from 'react';
import { Button, Card, CardBody, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { GripVerticalIcon } from '@patternfly/react-icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  id: string;
  laneIndex: number;
  index: number;
  label: string;
  children: React.ReactNode;
  /** Phone width: no drag, a "Move to…" select instead. */
  narrow?: boolean;
  locked?: boolean;
  laneOptions?: { key: string; title: string }[];
  onMoveTo?(laneKey: string): void;
  overlay?: boolean;
}

/** One card: a drag handle (pointer or keyboard) beside the caller's content. */
export const KanbanCard: React.FunctionComponent<Props> = ({
  id,
  laneIndex,
  index,
  label,
  children,
  narrow,
  locked,
  laneOptions,
  onMoveTo,
}) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: narrow || locked,
    data: { type: 'card', laneIndex },
  });
  return (
    <div
      ref={setNodeRef}
      data-card-index={index}
      data-card-lane={laneIndex}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Card isCompact>
        <CardBody>
          <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--xs)', alignItems: 'flex-start' }}>
            {!narrow && (
              <Button
                variant="plain"
                size="sm"
                {...attributes}
                {...listeners}
                ref={setActivatorNodeRef}
                isDisabled={locked}
                aria-label={`Move ${label}`}
                icon={<GripVerticalIcon />}
                style={{ touchAction: 'none', flex: '0 0 auto' }}
              />
            )}
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>{children}</div>
          </div>
          {narrow && laneOptions && (
            <FormSelect
              aria-label={`Move ${label} to…`}
              isDisabled={locked}
              value=""
              onChange={(_e, v) => v && onMoveTo?.(v)}
              className="pf-v6-u-mt-sm"
            >
              <FormSelectOption value="" label="Move to…" isDisabled isPlaceholder />
              {laneOptions.map((o) => (
                <FormSelectOption key={o.key} value={o.key} label={o.title} />
              ))}
            </FormSelect>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
