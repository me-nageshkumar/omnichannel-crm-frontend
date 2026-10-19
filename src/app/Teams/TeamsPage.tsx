import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Team, createTeam, listTeams } from '@app/api/teams';
import { listWorkspaceUsers } from '@app/api/workspaceUsers';
import { NameModal } from '@app/admin/NameModal';
import { PageShell } from '@app/admin/PageShell';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { TeamModal } from '@app/Teams/TeamModal';

type Dialog = { kind: 'create' } | { kind: 'edit'; team: Team };

/** The current brand's teams. */
export const TeamsPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const workspaceId = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('team:manage');
  const teams = useLoad((t) => listTeams(t, workspaceId), [workspaceId]);
  const people = useLoad(
    (t) => (canManage ? listWorkspaceUsers(t, workspaceId) : Promise.resolve([])),
    [workspaceId, canManage],
  );
  const [dialog, setDialog] = React.useState<Dialog | null>(null);

  const saved = (team: Team) => {
    teams.setData((list) => upsert(list ?? [], team));
    setDialog(null);
  };

  return (
    <PageShell
      title="Teams"
      actions={
        canManage && (
          <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
            Add team
          </Button>
        )
      }
    >
      {teams.error && <Alert variant="danger" isInline title={teams.error} />}
      {teams.loading && !teams.data ? (
        <Spinner aria-label="Loading teams" />
      ) : (
        <Table aria-label="Teams" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Members</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(teams.data ?? []).map((team) => (
              <Tr key={team.id}>
                <Td dataLabel="Name">{team.name}</Td>
                <Td dataLabel="Members">{team.members.length}</Td>
                <Td isActionCell>
                  {canManage && (
                    <ActionsColumn items={[{ title: 'Edit', onClick: () => setDialog({ kind: 'edit', team }) }]} />
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'create' && (
        <NameModal
          title="Add team"
          submitLabel="Create"
          save={(name) => createTeam(token as string, workspaceId, name)}
          onSaved={saved}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'edit' && (
        <TeamModal
          workspaceId={workspaceId}
          team={dialog.team}
          people={people.data ?? []}
          onSaved={saved}
          onCancel={() => setDialog(null)}
        />
      )}
    </PageShell>
  );
};
