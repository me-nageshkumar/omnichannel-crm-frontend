import * as React from 'react';
import { Menu, MenuContent, MenuItem, MenuList, SearchInput, Spinner } from '@patternfly/react-core';
import { messageFor } from '@app/api/messages';
import { TemplateFilters, TemplateView, listTemplates } from '@app/api/templates';
import { useSession } from '@app/session/SessionContext';
import { TYPE_META } from '@app/Templates/typeMeta';

const DEBOUNCE_MS = 300;

/**
 * A searchable list of templates. {@code unavailable} returns the reason a template cannot be picked, or null.
 * A failed load is reported through {@code onError}; a successful one clears it.
 */
export const TemplateSearchList: React.FunctionComponent<{
  filters: Omit<TemplateFilters, 'q'>;
  selectedIds: string[];
  unavailable(t: TemplateView): string | null;
  onPick(t: TemplateView): void;
  onError(message: string | null): void;
}> = ({ filters, selectedIds, unavailable, onPick, onError }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;

  const [search, setSearch] = React.useState('');
  const [templates, setTemplates] = React.useState<TemplateView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const report = React.useRef(onError);
  report.current = onError;
  const { status, type } = filters;

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(
      () => {
        listTemplates(t, ws, { status, type, q: search.trim() }).then(
          (items) => {
            if (!live) return;
            setTemplates(items);
            report.current(null);
            setLoading(false);
          },
          (e) => {
            if (!live) return;
            setTemplates([]);
            setLoading(false);
            report.current(messageFor(e));
          },
        );
      },
      search === '' ? 0 : DEBOUNCE_MS,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search, status, type, t, ws]);

  return (
    <>
      <SearchInput
        aria-label="Search templates"
        placeholder="Search templates"
        value={search}
        onChange={(_e, v) => setSearch(v)}
        onClear={() => setSearch('')}
      />
      {loading && <Spinner size="md" aria-label="Loading templates" />}
      {!loading && templates.length === 0 && <p>No templates found</p>}
      {templates.length > 0 && (
        <Menu aria-label="Templates" isPlain activeItemId={selectedIds[0]}>
          <MenuContent>
            <MenuList>
              {templates.map((tpl) => {
                const reason = unavailable(tpl);
                return (
                  <MenuItem
                    key={tpl.id}
                    itemId={tpl.id}
                    isDisabled={reason !== null}
                    isSelected={selectedIds.includes(tpl.id)}
                    description={reason ?? TYPE_META[tpl.type].label}
                    onClick={() => onPick(tpl)}
                  >
                    {tpl.name}
                    {reason !== null ? ` (${TYPE_META[tpl.type].label})` : ''}
                  </MenuItem>
                );
              })}
            </MenuList>
          </MenuContent>
        </Menu>
      )}
    </>
  );
};
