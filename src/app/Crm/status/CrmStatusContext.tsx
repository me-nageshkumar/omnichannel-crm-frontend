import * as React from 'react';
import { CrmStatus, getStatus } from '@app/api/crm';
import { useSession } from '@app/session/SessionContext';
import { CrmReminders } from '@app/Crm/tasks/CrmReminders';

interface CrmStatusValue {
  /** The brand's CRM status; null while unknown, without the CRM view authority, or when loading failed. */
  status: CrmStatus | null;
  loading: boolean;
  /** True when the status call failed: the status is then unknown, which is not the same as the CRM being off. */
  error: boolean;
  reload(): void;
}

const NONE: CrmStatusValue = { status: null, loading: false, error: false, reload: () => undefined };
const CrmStatusContext = React.createContext<CrmStatusValue>(NONE);
const ReminderCountContext = React.createContext(0);

/** Loads the current brand's CRM status once per brand (and on reload); a brand's users without crm:view make no call. */
export const CrmStatusProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const { token, workspace } = useSession();
  const wsId = workspace?.id ?? null;
  const allowed = !!token && !!wsId && workspace?.authorities.includes('crm:view') === true;
  const [loaded, setLoaded] = React.useState<{ key: string; status: CrmStatus | null; error: boolean } | null>(null);
  const [tick, setTick] = React.useState(0);
  const key = `${wsId}#${tick}`;

  React.useEffect(() => {
    if (!allowed || !token || !wsId) return undefined;
    let live = true;
    getStatus(token, wsId).then(
      (status) => live && setLoaded({ key, status, error: false }),
      () => live && setLoaded({ key, status: null, error: true }),
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
    return { status: current ? loaded.status : null, loading: !current, error: current && loaded.error, reload };
  }, [allowed, loaded, key, reload]);

  const [reminders, setReminders] = React.useState(0);
  const remindersOn = value.status?.enabled === true;
  React.useEffect(() => {
    if (!remindersOn) setReminders(0);
  }, [remindersOn]);

  return (
    <CrmStatusContext.Provider value={value}>
      <ReminderCountContext.Provider value={remindersOn ? reminders : 0}>
        {children}
        {remindersOn && <CrmReminders key={wsId ?? ''} onCount={setReminders} />}
      </ReminderCountContext.Provider>
    </CrmStatusContext.Provider>
  );
};

/** How many task reminders of the signed-in user are due and not yet seen, as of the last poll. */
export const useCrmReminderCount = (): number => React.useContext(ReminderCountContext);

export const useCrmStatus = (): CrmStatusValue => React.useContext(CrmStatusContext);

/** Whether the CRM status of the current brand grants {@code code}. */
export const useCrmCan = (code: string): boolean => useCrmStatus().status?.authorities.includes(code) ?? false;
