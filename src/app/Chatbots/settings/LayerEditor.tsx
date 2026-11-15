import * as React from 'react';
import { Alert, AlertActionLink, Button } from '@patternfly/react-core';
import type { InheritedSource, SettingField, SettingsLayer } from '@app/api/chatbots';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useAction } from '@app/admin/useAction';
import { LayeredSettingsForm } from './LayeredSettingsForm';
import { FIELDS, LayerDraft, fromDraft, layerProblems, toDraft } from './settingsLayers';

export const CONFLICT_MESSAGE = 'Someone else changed these settings. Reload to see their version.';

const same = (a: SettingsLayer, b: SettingsLayer) => FIELDS.every((f) => a[f] === b[f]);

/**
 * Edits one stored layer (the platform's or a brand's): Save sends the whole layer with the version it was read at;
 * server field errors under `errorPrefix.` land on their fields; a stale save offers a reload.
 */
export const LayerEditor: React.FunctionComponent<{
  loaded: SettingsLayer;
  /** The stored version the layer was read at; `null` when nothing is stored yet. */
  version: number | null;
  inherited: SettingsLayer | null;
  sources: Partial<Record<SettingField, InheritedSource>>;
  readOnly: boolean;
  errorPrefix: string;
  save(layer: SettingsLayer, version: number | null): Promise<{ layer: SettingsLayer; version: number | null }>;
  reload(): void;
}> = ({ loaded, version: loadedVersion, inherited, sources, readOnly, errorPrefix, save, reload }) => {
  const action = useAction(FIELDS.map((f) => `${errorPrefix}.${f}`));
  const [draft, setDraft] = React.useState<LayerDraft>(() => toDraft(loaded));
  const [base, setBase] = React.useState<SettingsLayer>(loaded);
  const [saved, setSaved] = React.useState(false);
  // kept here, not in the page: the editor remounts per brand and per load, so a version never crosses brands
  const [version, setVersion] = React.useState<number | null>(loadedVersion);

  const problems = layerProblems(draft, inherited === null);
  const serverErrors: Partial<Record<SettingField, string>> = {};
  for (const [k, v] of Object.entries(action.fieldErrors)) {
    if (k.startsWith(`${errorPrefix}.`)) serverErrors[k.slice(errorPrefix.length + 1) as SettingField] = v;
  }
  const errors = { ...serverErrors, ...problems };
  const current = fromDraft(draft);
  const canSave = Object.keys(problems).length === 0 && !same(current, base) && !action.busy;

  const submit = async () => {
    setSaved(false);
    const reply = await action.run(
      () => save(current, version),
      (e) => (e instanceof ApiError && e.status === 409 ? CONFLICT_MESSAGE : messageFor(e)),
    );
    if (reply) {
      setDraft(toDraft(reply.layer));
      setBase(reply.layer);
      setVersion(reply.version);
      setSaved(true);
    }
  };

  return (
    <>
      {action.error && (
        <Alert
          variant="danger"
          isInline
          title={action.error}
          actionLinks={
            action.error === CONFLICT_MESSAGE ? <AlertActionLink onClick={reload}>Reload</AlertActionLink> : undefined
          }
        />
      )}
      {saved && <Alert variant="success" isInline title="Settings saved" />}
      <LayeredSettingsForm
        value={draft}
        onChange={(d) => {
          setDraft(d);
          setSaved(false);
        }}
        inherited={inherited}
        sources={sources}
        readOnly={readOnly}
        errors={errors}
      />
      {!readOnly && (
        <div className="pf-v6-u-mt-md">
          <Button variant="primary" isDisabled={!canSave} isLoading={action.busy} onClick={() => void submit()}>
            Save
          </Button>
        </div>
      )}
    </>
  );
};
