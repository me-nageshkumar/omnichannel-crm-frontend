import * as React from 'react';
import { Button, Flex, FlexItem, HelperText, HelperTextItem } from '@patternfly/react-core';
import { apiFetchBlob } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';
import { saveBlob } from '@app/Billing/common/download';

/**
 * Downloads a document's PDF. The file needs the session's token, so it is fetched and then handed to the browser
 * to save; a failure is said beside the button and nothing is saved.
 */
export const PdfButton: React.FunctionComponent<{ path: string; filename: string }> = ({ path, filename }) => {
  const { token } = useSession();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      saveBlob(await apiFetchBlob(path, token as string), filename);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
      <FlexItem>
        <Button variant="secondary" onClick={() => void download()} isDisabled={busy} isLoading={busy}>
          Download PDF
        </Button>
      </FlexItem>
      {error && (
        <FlexItem>
          <HelperText>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        </FlexItem>
      )}
    </Flex>
  );
};
