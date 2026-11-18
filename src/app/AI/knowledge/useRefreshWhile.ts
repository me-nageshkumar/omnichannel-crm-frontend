import * as React from 'react';

/** Calls `reload` every `ms` while `active` is true and the component is mounted; stops as soon as it is false. */
export function useRefreshWhile(active: boolean, reload: () => void, ms = 3000): void {
  const latest = React.useRef(reload);
  latest.current = reload;
  React.useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => latest.current(), ms);
    return () => clearInterval(timer);
  }, [active, ms]);
}
