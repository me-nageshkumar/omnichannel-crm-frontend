import * as React from 'react';
import { listWorkspaceUsers } from '@app/api/workspaceUsers';
import { useSession } from '@app/session/SessionContext';
import type { FieldUser } from '@app/Crm/common/fields/types';

const cache = new Map<string, Promise<FieldUser[]>>();

/** For tests: forgets the cached lists. */
export const resetBrandUsers = (): void => cache.clear();

/**
 * The brand's people for USER fields and task assignees, fetched once per brand for the session. Callers who may not
 * read the brand's user list get an empty list (the pickers then offer the people already on the records).
 */
export function useBrandUsers(): FieldUser[] {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [users, setUsers] = React.useState<{ ws: string; list: FieldUser[] } | null>(null);
  React.useEffect(() => {
    if (!token || !ws) return undefined;
    let live = true;
    let hit = cache.get(ws);
    if (!hit) {
      hit = listWorkspaceUsers(token, ws).then(
        (list) => list.filter((u) => u.active !== false).map((u) => ({ id: u.id, name: u.name })),
        () => {
          cache.delete(ws);
          return [];
        },
      );
      cache.set(ws, hit);
    }
    hit.then((list) => live && setUsers({ ws, list }));
    return () => {
      live = false;
    };
  }, [token, ws]);
  return users?.ws === ws ? users.list : [];
}
