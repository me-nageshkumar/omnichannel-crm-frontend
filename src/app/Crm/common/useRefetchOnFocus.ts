import * as React from 'react';

const MIN_GAP_MS = 5000;

/** Calls {@code reload} when the tab becomes visible again, at most once every 5 seconds. */
export function useRefetchOnFocus(reload: () => void): void {
  const latest = React.useRef(reload);
  latest.current = reload;
  React.useEffect(() => {
    // A focus right after mount would only repeat the load that has just run.
    let last = Date.now();
    const onChange = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      latest.current();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
}
