import * as React from 'react';
import {
  Button,
  DatePicker,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import type { CrmPhone, Pipeline, Ref } from '@app/api/crm';
import { personName } from '@app/Crm/personName';
import { PRESETS, type Preset, type ReportState } from '@app/Crm/reports/reportFilter';

const NumbersPicker: React.FunctionComponent<{ phones: CrmPhone[]; value: string[]; onChange(v: string[]): void }> = ({
  phones,
  value,
  onChange,
}) => {
  const [open, setOpen] = React.useState(false);
  const text = value.length === 0 ? 'All numbers' : value.length === 1 ? '1 number' : `${value.length} numbers`;
  return (
    <Select
      isOpen={open}
      onOpenChange={setOpen}
      selected={value}
      onSelect={(_e, picked) => {
        const id = String(picked);
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
      }}
      toggle={(ref) => (
        <MenuToggle ref={ref} aria-label="Numbers" isExpanded={open} onClick={() => setOpen((o) => !o)}>
          {text}
        </MenuToggle>
      )}
    >
      <SelectList>
        {phones.map((p) => (
          <SelectOption
            key={p.phoneNumberId}
            value={p.phoneNumberId}
            hasCheckbox
            isSelected={value.includes(p.phoneNumberId)}
          >
            {p.label || p.number}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};

export interface ReportFilterBarProps {
  state: ReportState;
  onChange(next: ReportState): void;
  pipelines: Pipeline[];
  phones: CrmPhone[];
  /** The people to offer besides "Me" (the signed-in user, {@code meId}). */
  owners: Ref[];
  meId: string;
  canPickOwner: boolean;
  onRefresh(): void;
  /** Why the custom range can't be used yet. */
  error?: string | null;
}

/** The range, pipeline, numbers and (for view-all users) owner of every report on the page, plus Refresh. */
export const ReportFilterBar: React.FunctionComponent<ReportFilterBarProps> = ({
  state,
  onChange,
  pipelines,
  phones,
  owners,
  meId,
  canPickOwner,
  onRefresh,
  error,
}) => {
  const set = (patch: Partial<ReportState>) => onChange({ ...state, ...patch });
  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarGroup variant="filter-group">
            <ToolbarItem>
              <FormSelect aria-label="Range" value={state.preset} onChange={(_e, v) => set({ preset: v as Preset })}>
                {PRESETS.map((p) => (
                  <FormSelectOption key={p.key} value={p.key} label={p.label} />
                ))}
              </FormSelect>
            </ToolbarItem>
            {state.preset === 'custom' && (
              <>
                <ToolbarItem>
                  <DatePicker
                    aria-label="From"
                    placeholder="yyyy-mm-dd"
                    value={state.from ?? ''}
                    onChange={(_e, v) => set({ from: v })}
                  />
                </ToolbarItem>
                <ToolbarItem>
                  <DatePicker
                    aria-label="To"
                    placeholder="yyyy-mm-dd"
                    value={state.to ?? ''}
                    onChange={(_e, v) => set({ to: v })}
                  />
                </ToolbarItem>
              </>
            )}
            <ToolbarItem>
              <FormSelect aria-label="Pipeline" value={state.pipelineId} onChange={(_e, v) => set({ pipelineId: v })}>
                {pipelines.map((p) => (
                  <FormSelectOption key={p.id} value={p.id} label={p.active ? p.name : `${p.name} (inactive)`} />
                ))}
              </FormSelect>
            </ToolbarItem>
            {phones.length > 0 && (
              <ToolbarItem>
                <NumbersPicker phones={phones} value={state.numbers} onChange={(numbers) => set({ numbers })} />
              </ToolbarItem>
            )}
            {canPickOwner && (
              <ToolbarItem>
                <FormSelect aria-label="Owner" value={state.ownerId} onChange={(_e, v) => set({ ownerId: v })}>
                  <FormSelectOption value="" label="Everyone" />
                  <FormSelectOption value={meId} label="Me" />
                  {owners.map((o) => (
                    <FormSelectOption key={o.id} value={o.id} label={personName(o)} />
                  ))}
                </FormSelect>
              </ToolbarItem>
            )}
          </ToolbarGroup>
          <ToolbarItem>
            <Button variant="plain" aria-label="Refresh" icon={<SyncAltIcon />} onClick={onRefresh} />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {error && (
        <HelperText className="crm-reports__filter-error">
          <HelperTextItem variant="error">{error}</HelperTextItem>
        </HelperText>
      )}
    </>
  );
};
