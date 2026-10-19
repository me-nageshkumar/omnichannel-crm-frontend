import * as React from 'react';
import { ApiError, setUnauthorizedHandler } from '@app/api/client';
import { logout } from '@app/api/auth';
import { MESSAGES, messageFor } from '@app/api/messages';
import { CurrentUser, WorkspaceAccess, getCurrentUser } from '@app/api/users';
import { SESSION_KEY, clearSession, hasStoredValue, readSession, writeSession } from '@app/session/sessionStore';
import { readWorkspaceId, writeWorkspaceId } from '@app/session/workspaceStore';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface Session {
  status: SessionStatus;
  user: CurrentUser | null;
  token: string | null;
  /** A message for the login page: why the user is signed out, or why sign-in failed. */
  notice: string | null;
  pendingTwoFactorToken: string | null;
  /** Held only in memory, like the two-factor token. */
  pendingPasswordChangeToken: string | null;
  startPasswordChange(passwordChangeToken: string): void;
  /** The brand the user is working in; null when they have none. */
  workspace: WorkspaceAccess | null;
  selectWorkspace(id: string): void;
  startTwoFactor(twoFactorToken: string): void;
  /** Fetches the user for a fresh token; true when signed in. Failures land in {@link notice}. */
  signIn(token: string, expiresAt: string): Promise<boolean>;
  signOut(notice?: string): Promise<void>;
  refreshUser(): Promise<void>;
  showNotice(notice: string | null): void;
}

const SessionContext = React.createContext<Session | null>(null);

export function useSession(): Session {
  const session = React.useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}

interface State {
  status: SessionStatus;
  user: CurrentUser | null;
  token: string | null;
  notice: string | null;
  pendingTwoFactorToken: string | null;
  pendingPasswordChangeToken: string | null;
}

/** The largest delay setTimeout honours (2^31 - 1 ms); longer ones fire immediately. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

const SIGNED_OUT: Omit<State, 'notice'> = {
  status: 'signedOut',
  user: null,
  token: null,
  pendingTwoFactorToken: null,
  pendingPasswordChangeToken: null,
};

function failureNotice(error: unknown): string {
  return error instanceof ApiError && error.status === 401 ? MESSAGES.sessionExpired : messageFor(error);
}

export const SessionProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<State>({ ...SIGNED_OUT, status: 'loading', notice: null });
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(() => readWorkspaceId());

  const signedOut = React.useCallback((notice: string | null) => {
    clearSession();
    setState({ ...SIGNED_OUT, notice });
  }, []);

  /** Loads the user for {@code token}; only the super admin may use the console. */
  const establish = React.useCallback(
    async (token: string, expiresAt: string): Promise<boolean> => {
      try {
        const user = await getCurrentUser(token);
        writeSession({ token, expiresAt });
        setExpiresAt(expiresAt);
        setState({
          status: 'signedIn',
          user,
          token,
          notice: null,
          pendingTwoFactorToken: null,
          pendingPasswordChangeToken: null,
        });
        return true;
      } catch (error) {
        signedOut(failureNotice(error));
        return false;
      }
    },
    [signedOut],
  );

  React.useEffect(() => {
    const stored = readSession();
    if (stored) {
      establish(stored.token, stored.expiresAt);
    } else {
      signedOut(hasStoredValue() ? MESSAGES.sessionExpired : null);
    }
  }, [establish, signedOut]);

  const signedIn = state.status === 'signedIn';

  // A 401 from any non-auth call means this session is dead: sign out locally, no server call.
  React.useEffect(() => {
    if (!signedIn) return undefined;
    setUnauthorizedHandler(() => signedOut(MESSAGES.sessionExpired));
    return () => setUnauthorizedHandler(null);
  }, [signedIn, signedOut]);

  // The token's own expiry. setTimeout overflows past ~24.8 days, so wait in capped steps.
  React.useEffect(() => {
    if (!signedIn || !expiresAt) return undefined;
    const deadline = new Date(expiresAt).getTime();
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        signedOut(MESSAGES.sessionExpired);
        return;
      }
      timer = setTimeout(wait, Math.min(remaining, MAX_TIMER_DELAY_MS));
    };
    wait();
    return () => clearTimeout(timer);
  }, [signedIn, expiresAt, signedOut]);

  // Another tab logged out (it removed the shared session).
  React.useEffect(() => {
    if (!signedIn) return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY && event.newValue === null) {
        setState({ ...SIGNED_OUT, notice: MESSAGES.loggedOutElsewhere });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [signedIn]);

  const signOut = React.useCallback(
    async (notice?: string) => {
      const token = state.token;
      if (token) await logout(token).catch(() => undefined);
      signedOut(notice ?? null);
    },
    [state.token, signedOut],
  );

  const refreshUser = React.useCallback(async () => {
    if (!state.token) return;
    const user = await getCurrentUser(state.token);
    setState((s) => ({ ...s, user }));
  }, [state.token]);

  // A stored brand the user no longer has falls back to their first.
  const workspaces = state.user?.workspaces ?? [];
  const workspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0] ?? null;

  const value: Session = {
    ...state,
    workspace,
    selectWorkspace: (id) => {
      writeWorkspaceId(id);
      setWorkspaceId(id);
    },
    startTwoFactor: (pendingTwoFactorToken) => setState((s) => ({ ...s, pendingTwoFactorToken, notice: null })),
    startPasswordChange: (pendingPasswordChangeToken) =>
      setState((s) => ({ ...s, pendingPasswordChangeToken, notice: null })),
    signIn: establish,
    signOut,
    refreshUser,
    showNotice: (notice) => setState((s) => ({ ...s, notice })),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
