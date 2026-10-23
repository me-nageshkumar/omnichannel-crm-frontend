import * as React from 'react';
import {
  Alert,
  Button,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import { companyTypeahead, createCompany } from '@app/api/crm';
import type { Ref } from '@app/api/crm';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

const DEBOUNCE_MS = 250;
const CREATE = '__create__';

/**
 * Picks one company by typing: matches by name prefix; with {@code canCreate} the last option, Create "<q>",
 * adds the company on the spot and selects it.
 */
export const CompanyTypeahead: React.FunctionComponent<{
  id?: string;
  value: Ref | null;
  onChange(ref: Ref | null): void;
  canCreate: boolean;
  invalid?: boolean;
}> = ({ id = 'crm-company-typeahead', value, onChange, canCreate, invalid }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState<Ref[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const latest = React.useRef(0);

  const q = (text ?? '').trim();
  // text is null until the user types; the box then shows the chosen company.
  const shown = text ?? value?.name ?? '';

  React.useEffect(() => {
    if (!open || !token) return undefined;
    const seq = ++latest.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      companyTypeahead(token, ws, q).then(
        (found) => {
          if (seq !== latest.current) return;
          setOptions(found);
          setLoading(false);
        },
        (e) => {
          if (seq !== latest.current) return;
          setError(messageFor(e));
          setLoading(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, q, token, ws]);

  const choose = (ref: Ref | null) => {
    latest.current++;
    setError(null);
    onChange(ref);
    setText(null);
    setOpen(false);
  };

  const create = async () => {
    const name = q;
    setCreating(true);
    setError(null);
    try {
      const made = await createCompany(token as string, ws, { name });
      choose({ id: made.id, name: made.name });
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setCreating(false);
    }
  };

  const toggle = (ref: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={ref}
      variant="typeahead"
      isExpanded={open}
      isFullWidth
      status={invalid ? 'danger' : undefined}
      onClick={() => setOpen((o) => !o)}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          inputId={id}
          aria-label="Company"
          value={shown}
          placeholder="Search companies"
          autoComplete="off"
          role="combobox"
          isExpanded={open}
          onClick={() => setOpen(true)}
          onChange={(_e, v) => {
            setText(v);
            setOpen(true);
          }}
        />
        <TextInputGroupUtilities {...(shown ? {} : { style: { display: 'none' } })}>
          <Button variant="plain" aria-label="Clear company" icon={<TimesIcon />} onClick={() => choose(null)} />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <>
      {error && <Alert variant="danger" isInline isPlain title={error} />}
      <Select
        isOpen={open}
        isScrollable
        popperProps={{ appendTo: 'inline' }}
        selected={value?.id}
        toggle={toggle}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setText(null);
        }}
        onSelect={(_e, v) => {
          if (v === CREATE) void create();
          else choose(options.find((o) => o.id === v) ?? null);
        }}
      >
        <SelectList>
          {loading && options.length === 0 && (
            <SelectOption isDisabled value="__loading__">
              <Spinner size="md" aria-label="Searching companies" />
            </SelectOption>
          )}
          {!loading && options.length === 0 && !(canCreate && q) && (
            <SelectOption isDisabled value="__none__">
              No companies found
            </SelectOption>
          )}
          {options.map((o) => (
            <SelectOption key={o.id} value={o.id}>
              {o.name}
            </SelectOption>
          ))}
          {canCreate && q && (
            <SelectOption value={CREATE} isDisabled={creating}>
              {`Create "${q}"`}
            </SelectOption>
          )}
        </SelectList>
      </Select>
    </>
  );
};
