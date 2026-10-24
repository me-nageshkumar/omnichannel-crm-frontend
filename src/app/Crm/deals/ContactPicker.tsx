import * as React from 'react';
import { FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { searchContacts } from '@app/api/crm';
import type { CrmContact } from '@app/api/crm';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

const PAGE = 20;

export const contactLabel = (c: CrmContact): string => {
  const name = c.name || [c.firstName, c.lastName].filter(Boolean).join(' ');
  if (name && c.phone && name !== c.phone) return `${name} (${c.phone})`;
  return name || c.phone || c.id;
};

/** Picks one CRM contact: a search box narrows the list of matches below it. */
export const ContactPicker: React.FunctionComponent<{
  id: string;
  value: string;
  /** Names the current value while it is not among the matches (e.g. an existing deal's contact). */
  selectedLabel?: string;
  isDisabled?: boolean;
  invalid?: boolean;
  onChange(id: string): void;
}> = ({ id, value, selectedLabel, isDisabled, invalid, onChange }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [chosen, setChosen] = React.useState<{ id: string; label: string } | null>(
    value && selectedLabel ? { id: value, label: selectedLabel } : null,
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const found = useLoad(
    (t) => (isDisabled ? Promise.resolve(undefined) : searchContacts(t, ws, { q: q || undefined, page: 0, size: PAGE })),
    [ws, q, isDisabled],
    { keepOnError: true },
  );
  const options = (found.data?.items ?? []).map((c) => ({ id: c.id, label: contactLabel(c) }));
  if (chosen && !options.some((o) => o.id === chosen.id)) options.unshift(chosen);

  return (
    <>
      {!isDisabled && (
        <TextInput
          aria-label="Search contacts"
          placeholder="Search by name or number"
          value={search}
          onChange={(_e, v) => setSearch(v)}
        />
      )}
      <FormSelect
        id={id}
        value={value}
        isDisabled={isDisabled}
        validated={invalid ? 'error' : 'default'}
        onChange={(_e, v) => {
          setChosen(options.find((o) => o.id === v) ?? null);
          onChange(v);
        }}
      >
        <FormSelectOption value="" label={found.loading && !found.data ? 'Loading…' : 'Choose a contact'} isPlaceholder />
        {options.map((o) => (
          <FormSelectOption key={o.id} value={o.id} label={o.label} />
        ))}
      </FormSelect>
    </>
  );
};
