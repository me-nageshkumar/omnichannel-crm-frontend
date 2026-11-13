import * as React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Asks before unsaved work is lost: the browser's own prompt on unload, and a confirm for the editor's own links
 * (the app's router has no data router, so other in-app navigation is not intercepted).
 */
export function useUnsavedGuard(dirty: boolean): { leave(to: string): void; pending: string | null; stay(): void; confirmLeave(): void } {
  const navigate = useNavigate();
  const [pending, setPending] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);
  const leave = (to: string) => {
    if (dirty) setPending(to);
    else navigate(to);
  };
  return {
    leave,
    pending,
    stay: () => setPending(null),
    confirmLeave: () => {
      const to = pending;
      setPending(null);
      if (to) navigate(to);
    },
  };
}
