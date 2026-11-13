import * as React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

/** A bezier edge with a small × at its middle to remove it (spec §8.1). */
export const FlowEdge: React.FunctionComponent<{
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: never;
  targetPosition: never;
  data?: { onRemove?(id: string): void; readOnly?: boolean };
  markerEnd?: string;
}> = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }) => {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {!data?.readOnly && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="omni-edge__remove"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            aria-label="Remove connection"
            onClick={() => data?.onRemove?.(id)}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
