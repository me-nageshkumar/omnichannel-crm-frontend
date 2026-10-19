export const WORKSPACE_KEY = 'omnichannel.workspace';

/** The id of the brand the user last worked in, or null when unknown or unreadable. */
export function readWorkspaceId(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export function writeWorkspaceId(id: string): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, id);
  } catch {
    // storage unavailable: the choice lasts until reload
  }
}
