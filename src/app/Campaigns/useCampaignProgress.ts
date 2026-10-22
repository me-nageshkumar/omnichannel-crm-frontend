import * as React from 'react';
import { CampaignDetail, CampaignStatus, getCampaign } from '@app/api/campaigns';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

/** How often a running campaign is fetched again. */
export const REFRESH_SECONDS = 5;

export interface CampaignProgress {
  campaign: CampaignDetail | undefined;
  /** The last fetch's failure; the campaign from before it stays. */
  error: string | null;
  fetching: boolean;
  /** Seconds to the next fetch while the campaign runs, otherwise null. */
  secondsLeft: number | null;
  refreshedAt: Date | null;
  refresh(): void;
}

/**
 * One campaign, fetched again every {@link REFRESH_SECONDS} seconds while it runs. Only the answer
 * to the latest request is shown; answers after unmount or for another id are dropped.
 */
export function useCampaignProgress(id: string): CampaignProgress {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [campaign, setCampaign] = React.useState<CampaignDetail | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  const [refreshedAt, setRefreshedAt] = React.useState<Date | null>(null);
  const latest = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const shown = React.useRef<CampaignDetail | undefined>(undefined);
  const loadRef = React.useRef<() => void>(() => undefined);

  const stop = () => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  };

  const countDown = (status: CampaignStatus | undefined) => {
    stop();
    if (status !== 'RUNNING') {
      setSecondsLeft(null);
      return;
    }
    let left = REFRESH_SECONDS;
    setSecondsLeft(left);
    timer.current = setInterval(() => {
      left -= 1;
      if (left > 0) {
        setSecondsLeft(left);
        return;
      }
      stop();
      setSecondsLeft(REFRESH_SECONDS);
      loadRef.current();
    }, 1000);
  };

  loadRef.current = () => {
    if (!token) return;
    const request = ++latest.current;
    setFetching(true);
    getCampaign(token, ws, id).then(
      (c) => {
        if (request !== latest.current) return;
        shown.current = c;
        setCampaign(c);
        setError(null);
        setRefreshedAt(new Date());
        setFetching(false);
        countDown(c.status);
      },
      (e) => {
        if (request !== latest.current) return;
        setError(messageFor(e));
        setFetching(false);
        countDown(shown.current?.status);
      },
    );
  };

  React.useEffect(() => {
    shown.current = undefined;
    setCampaign(undefined);
    setError(null);
    setSecondsLeft(null);
    setRefreshedAt(null);
    loadRef.current();
    return () => {
      stop();
      // Any answer still on its way is for a page that is gone (or for another campaign).
      latest.current += 1;
    };
  }, [token, ws, id]);

  return {
    campaign,
    error,
    fetching,
    secondsLeft,
    refreshedAt,
    refresh: () => {
      stop();
      loadRef.current();
    },
  };
}
