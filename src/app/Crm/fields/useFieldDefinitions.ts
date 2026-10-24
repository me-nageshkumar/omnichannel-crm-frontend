import * as React from 'react';
import { listFields } from '@app/api/crm';
import type { FieldDefinition, FieldEntityType } from '@app/api/crm';
import { useSession } from '@app/session/SessionContext';
import { resetBrandUsers } from '@app/Crm/fields/useBrandUsers';

// Definitions change rarely: one fetch per brand and record type for the session, dropped when Settings saves.
const cache = new Map<string, FieldDefinition[]>();
const listeners = new Set<() => void>();

/** Forgets the cached definitions of the brand (all brands without {@code ws}); open lists and forms refetch. */
export function invalidateFieldDefinitions(ws?: string): void {
  for (const k of Array.from(cache.keys())) if (!ws || k.startsWith(`${ws}#`)) cache.delete(k);
  listeners.forEach((l) => l());
}

/** For tests: starts each one with no cached definitions. */
export const resetFieldDefinitions = (): void => {
  invalidateFieldDefinitions();
  resetBrandUsers();
};

/**
 * The custom field definitions of a record type in the current brand, inactive ones included (a record may still hold
 * their values), by position. Empty while loading or when they cannot be loaded.
 */
export function useFieldDefinitions(entityType: FieldEntityType): {
  defs: FieldDefinition[];
  loading: boolean;
  reload(): void;
} {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const key = `${ws}#${entityType}`;
  const [loaded, setLoaded] = React.useState<{ key: string; defs: FieldDefinition[] } | null>(() => {
    const hit = cache.get(key);
    return hit ? { key, defs: hit } : null;
  });
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  React.useEffect(() => {
    if (!token || !ws) return undefined;
    const hit = cache.get(key);
    if (hit) {
      setLoaded({ key, defs: hit });
      return undefined;
    }
    let live = true;
    listFields(token, ws, entityType, true).then(
      (defs) => {
        const sorted = defs.filter((d) => d.entityType === entityType).sort((a, b) => a.position - b.position);
        cache.set(key, sorted);
        if (live) setLoaded({ key, defs: sorted });
      },
      () => live && setLoaded({ key, defs: [] }),
    );
    return () => {
      live = false;
    };
  }, [token, ws, key, entityType, tick]);

  const current = loaded?.key === key ? loaded.defs : null;
  const reload = React.useCallback(() => invalidateFieldDefinitions(ws), [ws]);
  return { defs: current ?? [], loading: current === null, reload };
}
