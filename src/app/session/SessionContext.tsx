import * as React from 'react';
import { ApiError } from '@app/api/client';
import { logout } from '@app/api/auth';
import { MESSAGES, messageFor } from '@app/api/messages';
import { CurrentUser, getCurrentUser } from '@app/api/users';
import { clearSession, hasStoredValue, readSession, writeSession } from '@app/session/sessionStore';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface Session {
  status: SessionStatus;
  user: CurrentUser | null;
  token: string | null;
  /** A message for the login page: why the user is signed out, or why sign-in failed. */
  notice: string | null;
  pendingTwoFactorToken: string | null;
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
}

const SIGNED_OUT: Omit<State, 'notice'> = { status: 'signedOut', user: null, token: null, pendingTwoFactorToken: null };

function failureNotice(error: unknown): string {
  return error instanceof ApiError && error.status === 401 ? MESSAGES.sessionExpired : messageFor(error);
}

export const SessionProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<State>({ ...SIGNED_OUT, status: 'loading', notice: null });

  const signedOut = React.useCallback((notice: string | null) => {
    clearSession();
    setState({ ...SIGNED_OUT, notice });
  }, []);

  /** Loads the user for {@code token}; only the super admin may use the console. */
  const establish = React.useCallback(
    async (token: string, expiresAt: string): Promise<boolean> => {
      try {
        const user = await getCurrentUser(token);
        if (user.role !== 'SUPER_ADMIN') {
          logout(token).catch(() => undefined);
          signedOut(MESSAGES.notSuperAdmin);
          return false;
        }
        writeSession({ token, expiresAt });
        setState({ status: 'signedIn', user, token, notice: null, pendingTwoFactorToken: null });
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

  const value: Session = {
    ...state,
    startTwoFactor: (pendingTwoFactorToken) => setState((s) => ({ ...s, pendingTwoFactorToken, notice: null })),
    signIn: establish,
    signOut,
    refreshUser,
    showNotice: (notice) => setState((s) => ({ ...s, notice })),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
