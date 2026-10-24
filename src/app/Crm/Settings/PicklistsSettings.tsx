import * as React from 'react';
import { ActionGroup, Alert, Button, Card, CardBody, CardTitle, Spinner } from '@patternfly/react-core';
import { getSettings, putSettings } from '@app/api/crm';
import type { CrmSettings } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { ConflictAlert, isCode } from '@app/Crm/Settings/ConflictAlert';
import { PicklistDraft, PicklistEditor, fromDrafts, toDrafts } from '@app/Crm/Settings/PicklistEditor';

type ListKey = 'lifecycleStatuses' | 'dealSources' | 'taskTypes' | 'lostReasons' | 'industries';

const LISTS: { key: ListKey; title: string; help: string }[] = [
  { key: 'lifecycleStatuses', title: 'Lifecycle stages', help: 'Where a contact is in your relationship.' },
  { key: 'dealSources', title: 'Deal sources', help: 'Where deals and contacts come from.' },
  { key: 'taskTypes', title: 'Task types', help: 'The kinds of follow-up people plan.' },
  { key: 'lostReasons', title: 'Lost reasons', help: 'Offered when a deal is closed as lost.' },
  { key: 'industries', title: 'Industries', help: 'Offered on companies; leave empty to type freely.' },
];

type Drafts = Record<ListKey, PicklistDraft[]>;

const draftsOf = (s: CrmSettings): Drafts =>
  Object.fromEntries(LISTS.map((l) => [l.key, toDrafts(s[l.key])])) as Drafts;

/** The five settings picklists, saved together with the rest of the settings and their version. */
export const PicklistsSettings: React.FunctionComponent<{ canManage: boolean }> = ({ canManage }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad((t) => getSettings(t, ws), [ws]);
  const action = useAction();
  const [drafts, setDrafts] = React.useState<Drafts | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const settings = loaded.data;
  React.useEffect(() => {
    if (!settings) return;
    setDrafts(draftsOf(settings));
    setConflict(false);
  }, [settings]);

  if (loaded.loading && !settings) return <Spinner aria-label="Loading picklists" />;
  if (!settings || !drafts) return <Alert variant="danger" isInline title={loaded.error ?? 'Could not load.'} />;

  const blankLabel = LISTS.some((l) => drafts[l.key].some((i) => !i.label.trim()));

  const save = async () => {
    setSaved(false);
    setConflict(false);
    const body: CrmSettings = { ...settings };
    for (const l of LISTS) body[l.key] = fromDrafts(drafts[l.key]);
    const result = await action.run(
      () => putSettings(token as string, ws, body),
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          setConflict(true);
          return '';
        }
        return 'Could not save the picklists. Try again.';
      },
    );
    if (result) {
      loaded.setData(() => result);
      setSaved(true);
    }
  };

  return (
    <div className="pf-v6-u-mt-md" style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--md)' }}>
      {conflict && <ConflictAlert onReload={() => loaded.reload()} />}
      {action.error && <Alert variant="danger" isInline title={action.error} />}
      {saved && <Alert variant="success" isInline title="Picklists saved" />}
      {LISTS.map((l) => (
        <Card key={l.key} component="section" aria-labelledby={`picklist-${l.key}`} isCompact>
          <CardTitle id={`picklist-${l.key}`} component="h3">
            {l.title}
          </CardTitle>
          <CardBody>
            <p className="pf-v6-u-color-200">{l.help}</p>
            {drafts[l.key].some((i) => i.saved) && (
              <p className="pf-v6-u-mb-sm pf-v6-u-font-size-sm pf-v6-u-color-200">
                Items in use can&apos;t be removed; switch them off instead.
              </p>
            )}
            <PicklistEditor
              list={l.key}
              items={drafts[l.key]}
              readOnly={!canManage}
              onChange={(next) => setDrafts({ ...drafts, [l.key]: next })}
            />
          </CardBody>
        </Card>
      ))}
      {canManage && (
        <ActionGroup>
          <Button
            variant="primary"
            isDisabled={blankLabel || action.busy}
            isLoading={action.busy}
            onClick={() => void save()}
          >
            Save picklists
          </Button>
        </ActionGroup>
      )}
    </div>
  );
};
