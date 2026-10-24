import type { Ref } from '@app/api/crm';

/** A person's name to show: the server sends null when it can't name them (the system actor, a removed user). */
export function personName(r: Pick<Ref, 'id' | 'name'> | null | undefined): string {
  if (!r) return '';
  if (r.name && r.name.trim()) return r.name;
  return r.id === 'system' ? 'System' : 'Unknown person';
}
