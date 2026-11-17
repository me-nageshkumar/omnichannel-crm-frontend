import * as React from 'react';
import { Checkbox, Content, FormFieldGroup, FormFieldGroupHeader, SearchInput } from '@patternfly/react-core';
import { type Authority, matchesSearch } from '@app/api/authorities';
import { AuthorityStatusLabel } from '@app/Authorities/AuthorityStatusLabel';

/**
 * Picks authorities, listed by their group with a search box. For use inside a form.
 *
 * @param disabledCodes code → why it cannot be changed here; shown beside its disabled checkbox
 * @param idPrefix keeps the element ids apart when two pickers could be on one page
 */
export const AuthorityPicker: React.FunctionComponent<{
  authorities: Authority[];
  selected: string[];
  onChange(next: string[]): void;
  disabledCodes?: Record<string, string>;
  idPrefix: string;
}> = ({ authorities, selected, onChange, disabledCodes = {}, idPrefix }) => {
  const [search, setSearch] = React.useState('');
  // A group whose name matches shows all its authorities; otherwise only the matching ones.
  const groups = Array.from(new Set(authorities.map((a) => a.group)))
    .sort()
    .map((group) => {
      const all = authorities.filter((a) => a.group === group).sort((a, b) => a.code.localeCompare(b.code));
      const q = search.trim().toLowerCase();
      const shown = !q || group.toLowerCase().includes(q) ? all : all.filter((a) => matchesSearch(a, search));
      return { group, all, shown };
    })
    .filter((g) => g.shown.length > 0);

  const toggle = (code: string, on: boolean) =>
    onChange(on ? [...selected.filter((c) => c !== code), code] : selected.filter((c) => c !== code));

  return (
    <>
      {authorities.length > 0 && (
        <SearchInput
          aria-label="Search authorities"
          placeholder="Search by code, group or description"
          value={search}
          onChange={(_e, v) => setSearch(v)}
          onClear={() => setSearch('')}
        />
      )}
      {groups.map(({ group, all, shown }) => (
        <section key={group} aria-label={group}>
          <FormFieldGroup
            header={
              <FormFieldGroupHeader
                titleText={{ text: group, id: `${idPrefix}-group-${group}` }}
                titleDescription={`${all.filter((a) => selected.includes(a.code)).length} of ${all.length} selected`}
              />
            }
          >
            {shown.map((a) => (
              <Checkbox
                key={a.code}
                id={`${idPrefix}-${a.code}`}
                label={
                  <>
                    {a.description} <AuthorityStatusLabel authority={a} />
                  </>
                }
                description={
                  <Content component="small">
                    {a.code}
                    {disabledCodes[a.code] ? ` · ${disabledCodes[a.code]}` : ''}
                  </Content>
                }
                isChecked={selected.includes(a.code)}
                isDisabled={a.code in disabledCodes}
                onChange={(_e, on) => toggle(a.code, on)}
              />
            ))}
          </FormFieldGroup>
        </section>
      ))}
    </>
  );
};
