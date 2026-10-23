import { apiFetch } from '@app/api/client';

export interface TeamMember {
  id: string;
  name: string;
  username: string;
}

export interface TeamNumber {
  id: string;
  number: string;
  label: string | null;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  /** The numbers this team works. */
  phoneNumbers: TeamNumber[];
}

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/teams`;

export const listTeams = (token: string, workspaceId: string) => apiFetch<Team[]>(base(workspaceId), { token });

export const createTeam = (token: string, workspaceId: string, name: string) =>
  apiFetch<Team>(base(workspaceId), { method: 'POST', token, body: { name } });

/** Always sends both fields: the server treats a missing member list as "no members". */
export const updateTeam = (token: string, workspaceId: string, teamId: string, name: string, memberIds: string[]) =>
  apiFetch<Team>(`${base(workspaceId)}/${teamId}`, { method: 'PUT', token, body: { name, memberIds } });
