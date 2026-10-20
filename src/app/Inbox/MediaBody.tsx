import * as React from 'react';
import { Alert, Button } from '@patternfly/react-core';
import { chatMediaUrl, fetchMedia } from '@app/api/inbox';
import type { MessageView } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

const GAP = 'var(--pf-t--global--spacer--sm)';
const MEDIA_STYLE: React.CSSProperties = { display: 'block', maxWidth: '100%', maxHeight: 320, borderRadius: 4 };

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface MediaBodyProps {
  chatId: string;
  message: MessageView;
}

/**
 * The media of a message. Bytes are fetched (with the auth header, as an object URL) only for a message
 * whose media is cached on the server, when it is shown, or when the user clicks Download; a document is
 * only ever saved on click.
 */
export const MediaBody: React.FunctionComponent<MediaBodyProps> = ({ chatId, message }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { id, type, media } = message;
  const isDocument = type === 'document';
  const autoLoad = !isDocument && media?.available === true;
  const [url, setUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const download = React.useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await fetchMedia(token, chatMediaUrl(ws, chatId, id));
      if (!mounted.current) return;
      const href = URL.createObjectURL(blob);
      if (isDocument) {
        const link = document.createElement('a');
        link.href = href;
        link.download = media?.filename ?? 'document';
        link.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      } else {
        setUrl(href);
      }
    } catch (e) {
      if (mounted.current) setError(messageFor(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [token, ws, chatId, id, isDocument, media?.filename]);

  React.useEffect(() => {
    if (autoLoad) void download();
  }, [autoLoad, download]);

  const label = media?.filename ?? type;
  let shown: React.ReactNode = null;
  if (url) {
    if (type === 'video') {
      shown = <video controls src={url} style={MEDIA_STYLE} />;
    } else if (type === 'audio' || type === 'ptt') {
      shown = <audio controls src={url} />;
    } else {
      shown = <img src={url} alt={label} style={MEDIA_STYLE} />;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      {isDocument && (
        <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
          <span aria-hidden="true">📄</span>
          <span style={{ flex: '1 1 auto', minWidth: 0 }}>
            <span style={{ display: 'block', overflowWrap: 'anywhere' }}>{media?.filename ?? 'Document'}</span>
            {media && <small>{fileSize(media.size)}</small>}
          </span>
        </div>
      )}
      {shown}
      {!url && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => void download()} isLoading={busy} isDisabled={busy}>
            Download
          </Button>
        </div>
      )}
      {error && <Alert variant="danger" isInline isPlain title={error} />}
    </div>
  );
};
