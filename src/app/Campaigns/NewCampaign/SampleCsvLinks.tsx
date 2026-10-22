import * as React from 'react';
import { Button, HelperText, HelperTextItem } from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { sampleCsv } from '@app/api/campaigns';
import { saveFile } from '@app/api/contacts';
import { messageFor } from '@app/api/messages';
import type { TemplateView } from '@app/api/templates';
import { useSession } from '@app/session/SessionContext';

/** One download per chosen template: a CSV whose columns are the phone, the name and that template's placeholders. */
export const SampleCsvLinks: React.FunctionComponent<{ templates: TemplateView[] }> = ({ templates }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const download = async (tpl: TemplateView) => {
    setBusy(true);
    setError(null);
    try {
      saveFile(await sampleCsv(token as string, ws, tpl.id), `${tpl.name} sample.csv`);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  if (templates.length === 0) return null;
  return (
    <div>
      {templates.map((tpl) => (
        <Button
          key={tpl.id}
          variant="link"
          isInline
          icon={<DownloadIcon />}
          isDisabled={busy}
          onClick={() => download(tpl)}
          style={{ marginRight: 16 }}
        >
          {templates.length === 1 ? 'Download sample CSV' : `Download sample CSV (${tpl.name})`}
        </Button>
      ))}
      {error && (
        <HelperText>
          <HelperTextItem variant="error">{error}</HelperTextItem>
        </HelperText>
      )}
    </div>
  );
};
