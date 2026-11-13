import * as React from 'react';
import { Button, SearchInput } from '@patternfly/react-core';
import type { NodeType } from '@app/api/chatbots';
import { DRAG_TYPE } from '@app/Chatbots/editor/FlowCanvas';
import { CATALOG, PALETTE } from '@app/Chatbots/nodeCatalog';

/** The node palette (spec §8.1): a search box and one entry per node type; click adds, drag places. */
export const NodePalette: React.FunctionComponent<{ onPick(type: NodeType): void }> = ({ onPick }) => {
  const [q, setQ] = React.useState('');
  const shown = PALETTE.filter((t) => {
    const m = CATALOG[t];
    const needle = q.trim().toLowerCase();
    return !needle || m.label.toLowerCase().indexOf(needle) >= 0 || m.description.toLowerCase().indexOf(needle) >= 0;
  });
  return (
    <div className="omni-palette nokey">
      <SearchInput
        aria-label="Search nodes"
        placeholder="Search nodes"
        value={q}
        onChange={(_e, v) => setQ(v)}
        onClear={() => setQ('')}
      />
      <ul className="omni-palette__list" aria-label="Node types">
        {shown.map((t) => {
          const m = CATALOG[t];
          const Icon = m.icon;
          return (
            <li
              key={t}
              className="omni-palette__item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, t);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <Button variant="plain" className="omni-palette__button" onClick={() => onPick(t)}>
                <span className="omni-palette__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>{m.label}</span>
              </Button>
              <small className="omni-palette__desc">{m.description}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
