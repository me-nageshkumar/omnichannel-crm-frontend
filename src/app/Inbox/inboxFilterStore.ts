/** The numbers a user last narrowed their inbox to, per brand; an empty list means every number they may open. */
export const filterKey = (userId: string, workspaceId: string) => `inbox.filter.${userId}.${workspaceId}`;

export function readInboxFilter(userId: string, workspaceId: string): string[] {
  try {
    const raw = localStorage.getItem(filterKey(userId, workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeInboxFilter(userId: string, workspaceId: string, ids: string[]): void {
  try {
    localStorage.setItem(filterKey(userId, workspaceId), JSON.stringify(ids));
  } catch {
    // storage unavailable: the choice lasts until reload
  }
}
