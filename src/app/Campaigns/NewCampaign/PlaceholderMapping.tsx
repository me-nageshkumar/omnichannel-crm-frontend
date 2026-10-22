import * as React from 'react';
import { FormSelect, FormSelectOption, HelperText, HelperTextItem, TextInput } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { PlaceholderView } from '@app/api/templates';
import {
  Mapping,
  MappingContext,
  decodeSource,
  encodeSource,
  mappingProblems,
  sourceOptions,
} from '@app/Campaigns/mapping';

const EMPTY: Mapping = { source: null, fallback: '' };

/** One row per placeholder: where its value comes from, and the fallback (or the fixed text). */
export const PlaceholderMapping: React.FunctionComponent<{
  placeholders: PlaceholderView[];
  mappings: Record<string, Mapping>;
  ctx: MappingContext;
  onChange(mappings: Record<string, Mapping>): void;
}> = ({ placeholders, mappings, ctx, onChange }) => {
  if (placeholders.length === 0) return null;
  const options = sourceOptions(ctx);
  const { unmapped, reused } = mappingProblems(placeholders, mappings);
  const set = (name: string, m: Mapping) => onChange({ ...mappings, [name]: m });

  return (
    <>
      <Table aria-label="Placeholders" variant="compact">
        <Thead>
          <Tr>
            <Th>Placeholder</Th>
            <Th>Source</Th>
            <Th>Value</Th>
          </Tr>
        </Thead>
        <Tbody>
          {placeholders.map((p) => {
            const m = mappings[p.name] ?? EMPTY;
            const s = m.source;
            return (
              <Tr key={p.name}>
                <Td dataLabel="Placeholder">
                  <code>{`{{${p.name}}}`}</code>
                </Td>
                <Td dataLabel="Source">
                  <FormSelect
                    aria-label={`Source for ${p.name}`}
                    value={encodeSource(s)}
                    validated={reused.includes(p.name) ? 'error' : 'default'}
                    onChange={(_e, v) => set(p.name, { ...m, source: decodeSource(v, m) })}
                  >
                    <FormSelectOption value="" label="Choose a source" isPlaceholder />
                    {options.map((o) => (
                      <FormSelectOption key={o.value} value={o.value} label={o.label} />
                    ))}
                  </FormSelect>
                  {reused.includes(p.name) && (
                    <HelperText>
                      <HelperTextItem variant="error">A CSV column can be used only once.</HelperTextItem>
                    </HelperText>
                  )}
                </Td>
                <Td dataLabel="Value">
                  {s?.kind === 'FIXED' ? (
                    <TextInput
                      key="fixed"
                      aria-label={`Fixed text for ${p.name}`}
                      value={s.text}
                      onChange={(_e, text) => set(p.name, { ...m, source: { kind: 'FIXED', text } })}
                    />
                  ) : (
                    <TextInput
                      key="fallback"
                      aria-label={`Fallback for ${p.name}`}
                      placeholder="Fallback (optional)"
                      value={m.fallback}
                      onChange={(_e, fallback) => set(p.name, { ...m, fallback })}
                    />
                  )}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      {unmapped.length > 0 && (
        <HelperText>
          <HelperTextItem variant="error">Every placeholder needs a value.</HelperTextItem>
        </HelperText>
      )}
    </>
  );
};
