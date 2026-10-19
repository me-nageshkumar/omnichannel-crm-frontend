import { useSession } from '@app/session/SessionContext';

export interface Access {
  superAdmin: boolean;
  /** A platform or company authority of the signed-in user. */
  has(code: string): boolean;
  /** An authority in the current brand. */
  hasInWorkspace(code: string): boolean;
}

/** "May I" for the signed-in user; the server's lists are the only source of truth. */
export function useAccess(): Access {
  const { user, workspace } = useSession();
  return {
    superAdmin: user?.superAdmin ?? false,
    has: (code) => user?.authorities.includes(code) ?? false,
    hasInWorkspace: (code) => workspace?.authorities.includes(code) ?? false,
  };
}
