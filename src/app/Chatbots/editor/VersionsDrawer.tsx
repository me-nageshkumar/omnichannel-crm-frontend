import * as React from 'react';
import { Alert, Button, Label, Spinner, Title } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import type { Chatbot, SaveResult, SavedFlow } from '@app/api/chatbots';
import { getVersionFlow, listVersions, restoreVersion } from '@app/api/chatbots';
import { messageFor } from '@app/api/messages';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useLoad } from '@app/admin/useLoad';
import { shortTime } from '@app/Crm/segments/segmentModel';
import { useSession } from '@app/session/SessionContext';

/**
 * The saved versions of a chatbot (spec §8.1): preview any of them on the canvas, restore one into the draft.
 * `onPreview(flow)` puts the canvas into read-only preview; `onPreview(null)` leaves it.
 */
export const VersionsDrawer: React.FunctionComponent<{
  chatbot: Chatbot;
  readOnly: boolean;
  onPreview(flow: SavedFlow | null): void;
  onRestored(result: SaveResult): void;
  onClose(): void;
}> = ({ chatbot, readOnly, onPreview, onRestored, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const versions = useLoad((tk) => listVersions(tk, ws, chatbot.id), [ws, chatbot.id, chatbot.versionNumber]);
  const [previewing, setPreviewing] = React.useState<number | null>(null);
  const [restoring, setRestoring] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const preview = async (n: number) => {
    if (!token) return;
    setError(null);
    try {
      onPreview(await getVersionFlow(token, ws, chatbot.id, n));
      setPreviewing(n);
    } catch (e) {
      setError(messageFor(e));
    }
  };
  const exit = () => {
    setPreviewing(null);
    onPreview(null);
  };
  const restore = async () => {
    if (!token || restoring === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await restoreVersion(token, ws, chatbot.id, restoring);
      setRestoring(null);
      setPreviewing(null);
      onPreview(null);
      onRestored(result);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="omni-drawer" role="dialog" aria-label="Versions">
      <div className="omni-drawer__head">
        <Title headingLevel="h2" size="lg">
          Versions
        </Title>
        <Button variant="plain" aria-label="Close" onClick={onClose}>
          <TimesIcon />
        </Button>
      </div>
      {error && <Alert variant="danger" isInline title={error} />}
      {previewing !== null && (
        <Alert
          variant="info"
          isInline
          title={`Previewing version ${previewing}`}
          actionLinks={
            <>
              {!readOnly && (
                <Button variant="link" isInline onClick={() => setRestoring(previewing)}>
                  Restore
                </Button>
              )}
              <Button variant="link" isInline onClick={exit}>
                Exit preview
              </Button>
            </>
          }
        />
      )}
      {versions.error && <Alert variant="danger" isInline title={versions.error} />}
      {!versions.data && !versions.error && <Spinner size="md" aria-label="Loading versions" />}
      {versions.data && (
        <ul className="omni-versions">
          {versions.data.map((v) => (
            <li key={v.versionNumber} className="omni-versions__item">
              <div>
                <strong>Version {v.versionNumber}</strong>
                {v.versionNumber === chatbot.versionNumber && (
                  <Label isCompact className="pf-v6-u-ml-sm">
                    current
                  </Label>
                )}
                <div className="pf-v6-u-color-200">
                  {shortTime(v.savedAt)}
                  {v.savedBy?.name ? ` · ${v.savedBy.name}` : ''}
                </div>
              </div>
              <div className="omni-versions__actions">
                <Button
                  variant="link"
                  isInline
                  onClick={() => void preview(v.versionNumber)}
                  isDisabled={previewing === v.versionNumber}
                >
                  Preview
                </Button>
                {!readOnly && v.versionNumber !== chatbot.versionNumber && (
                  <Button variant="link" isInline onClick={() => setRestoring(v.versionNumber)}>
                    Restore
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {restoring !== null && (
        <ConfirmModal
          title={`Restore version ${restoring}?`}
          confirmLabel="Restore"
          busy={busy}
          error={error}
          onConfirm={() => void restore()}
          onCancel={() => setRestoring(null)}
        >
          The draft becomes a copy of version {restoring}. Nothing is lost: the current flow stays in the history as its
          own version.
        </ConfirmModal>
      )}
    </section>
  );
};
