import * as React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Dropdown, DropdownItem, DropdownList, Label, MenuToggle, TextInput } from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import type { NodeData } from '@app/Chatbots/flowModel';
import { CATALOG } from '@app/Chatbots/nodeCatalog';
import { EditorContext } from '@app/Chatbots/editor/EditorContext';

/** One node on the canvas (spec §8.1): icon, name, a two-line preview, outputs as handles, problems, run state. */
export const FlowNodeCard: React.FunctionComponent<{ id: string; data: NodeData; selected?: boolean }> = ({
  id,
  data,
  selected,
}) => {
  const actions = React.useContext(EditorContext);
  const meta = CATALOG[data.type];
  const Icon = meta.icon;
  const outputs = meta.outputs(data.settings);
  const [menu, setMenu] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState(data.name);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const errors = data.problems.filter((p) => p.severity === 'ERROR').length;
  const warnings = data.problems.length - errors;

  const commit = () => {
    const problem = actions.rename(id, draft.trim());
    if (problem) setNameError(problem);
    else {
      setRenaming(false);
      setNameError(null);
    }
  };

  return (
    <div className={`omni-node${selected ? ' omni-node--selected' : ''}${data.run ? ` omni-node--${data.run}` : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="omni-node__head" onClick={() => actions.select(id)}>
        <span className="omni-node__icon" aria-hidden="true">
          <Icon />
        </span>
        {renaming ? (
          <TextInput
            aria-label="Node name"
            value={draft}
            autoFocus
            validated={nameError ? 'error' : 'default'}
            onChange={(_e, v) => setDraft(v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={commit}
          />
        ) : (
          <strong className="omni-node__name">{data.name}</strong>
        )}
        {data.entry && (
          <Label isCompact color="green">
            Entry
          </Label>
        )}
        {data.run && (
          <Label
            isCompact
            color={data.run === 'failed' ? 'red' : data.run === 'done' ? 'green' : 'blue'}
            className="omni-node__run"
          >
            {data.run === 'failed' ? 'Failed' : data.run === 'done' ? 'Done' : 'Waiting'}
          </Label>
        )}
        {errors > 0 && (
          <Label isCompact color="red" title={data.problems.map((p) => p.message).join('\n')}>
            {errors}
          </Label>
        )}
        {errors === 0 && warnings > 0 && (
          <Label isCompact color="orange" title={data.problems.map((p) => p.message).join('\n')}>
            {warnings}
          </Label>
        )}
        {!actions.readOnly && (
          <Dropdown
            isOpen={menu}
            onOpenChange={setMenu}
            onSelect={() => setMenu(false)}
            popperProps={{ position: 'right' }}
            toggle={(ref) => (
              <MenuToggle
                ref={ref}
                variant="plain"
                aria-label={`Actions for ${data.name}`}
                isExpanded={menu}
                onClick={() => setMenu((o) => !o)}
              >
                <EllipsisVIcon />
              </MenuToggle>
            )}
          >
            <DropdownList>
              <DropdownItem
                onClick={() => {
                  setDraft(data.name);
                  setRenaming(true);
                }}
              >
                Rename
              </DropdownItem>
              <DropdownItem onClick={() => actions.duplicate(id)}>Duplicate</DropdownItem>
              <DropdownItem onClick={() => actions.remove(id)}>Delete</DropdownItem>
            </DropdownList>
          </Dropdown>
        )}
        {!actions.readOnly && !renaming && (
          <button
            type="button"
            className="omni-node__rename pf-v6-u-screen-reader"
            aria-label={`Rename ${data.name}`}
            onClick={() => {
              setDraft(data.name);
              setRenaming(true);
            }}
          />
        )}
      </div>
      {nameError && <div className="omni-node__error">{nameError}</div>}
      <div className="omni-node__preview" onClick={() => actions.select(id)}>
        {meta.preview(data.settings, actions.options)}
      </div>
      {outputs.length > 0 && (
        <ul className="omni-node__outputs" aria-label={`Outputs of ${data.name}`}>
          {outputs.map((o) => (
            <li key={o.id} className="omni-node__output">
              <span>{o.label}</span>
              <Handle type="source" position={Position.Right} id={o.id} className="omni-node__handle" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
