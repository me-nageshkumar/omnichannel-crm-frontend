import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { PauseIcon, PlayIcon, StopIcon } from '@patternfly/react-icons';
import { HistoryImportStatus, isActive, isFetching } from '@app/api/historyImports';

/**
 * Pause and stop while an import is fetching, play and stop while it is paused, nothing once it has ended.
 * {@code subject} tells several imports on one screen apart for screen readers.
 */
export const HistoryImportControls: React.FunctionComponent<{
  status: HistoryImportStatus;
  busy: boolean;
  subject?: string;
  onPause(): void;
  onPlay(): void;
  onStop(): void;
}> = ({ status, busy, subject, onPause, onPlay, onStop }) => {
  if (!isActive(status)) return null;
  const label = (action: string) => (subject ? `${action} import of ${subject}` : undefined);
  return (
    <span style={{ display: 'inline-flex', gap: 'var(--pf-t--global--spacer--xs)' }}>
      {isFetching(status) ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<PauseIcon />}
          aria-label={label('Pause')}
          isDisabled={busy}
          onClick={onPause}
        >
          Pause
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          icon={<PlayIcon />}
          aria-label={label('Play')}
          isDisabled={busy}
          onClick={onPlay}
        >
          Play
        </Button>
      )}
      <Button
        variant="secondary"
        isDanger
        size="sm"
        icon={<StopIcon />}
        aria-label={label('Stop')}
        isDisabled={busy}
        onClick={onStop}
      >
        Stop
      </Button>
    </span>
  );
};
