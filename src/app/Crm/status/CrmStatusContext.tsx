import * as React from 'react';
import { CrmStatus, getStatus } from '@app/api/crm';
import { useSession } from '@app/session/SessionContext';

interface CrmStatusValue {
  /** The brand's CRM status; null while unknown, without the CRM view authority, or when loading failed. */
  status: CrmStatus | null;
  loading: boolean;
  reload(): void;
}

const NONE: CrmStatusValue = { status: null, loading: false, reload: () => undefined };
const CrmStatusContext = React.createContext<CrmStatusValue>(NONE);

/** Loads the current brand's CRM status once per brand (and on reload); a brand's users without crm:view make no call. */
export const CrmStatusProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const { token, workspace } = useSession();
  const wsId = workspace?.id ?? null;
  const allowed = !!token && !!wsId && workspace?.authorities.includes('crm:view') === true;
  const [loaded, setLoaded] = React.useState<{ key: string; status: CrmStatus | null } | null>(null);
  const [tick, setTick] = React.useState(0);
  const key = `${wsId}#${tick}`;

  React.useEffect(() => {
    if (!allowed || !token || !wsId) return undefined;
    let live = true;
    getStatus(token, wsId).then(
      (status) => live && setLoaded({ key, status }),
      () => live && setLoaded({ key, status: null }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, token, wsId, tick]);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  const value = React.useMemo<CrmStatusValue>(() => {
    if (!allowed) return NONE;
    // Anything loaded for another brand (or before a reload) is not this brand's answer.
    const current = loaded?.key === key;
    return { status: current ? loaded.status : null, loading: !current, reload };
  }, [allowed, loaded, key, reload]);

  return <CrmStatusContext.Provider value={value}>{children}</CrmStatusContext.Provider>;
};

export const useCrmStatus = (): CrmStatusValue => React.useContext(CrmStatusContext);

/** Whether the CRM status of the current brand grants {@code code}. */
export const useCrmCan = (code: string): boolean => useCrmStatus().status?.authorities.includes(code) ?? false;
