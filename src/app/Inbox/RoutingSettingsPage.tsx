import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import {
  RoutingSetting,
  deleteTeamRouting,
  getRoutingDefault,
  listTeamRouting,
  putRoutingDefault,
  putTeamRouting,
} from '@app/api/inbox';
import { listTeams } from '@app/api/teams';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { NotFound } from '@app/NotFound/NotFound';
import { RoutingSettingsCard } from '@app/Inbox/RoutingSettingsCard';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

const Cards: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const brand = useLoad((tk) => getRoutingDefault(tk, ws), [ws]);
  const teamSettings = useLoad((tk) => listTeamRouting(tk, ws), [ws]);
  const teams = useLoad((tk) => listTeams(tk, ws), [ws]);
  const error = brand.error ?? teamSettings.error ?? teams.error;
  if (error) return <Alert variant="danger" isInline title={error} />;
  if (!brand.data || !teamSettings.data || !teams.data) return <Spinner aria-label="Loading routing settings" />;

  const replaceTeam = (next: RoutingSetting) =>
    teamSettings.setData((list) => (list ?? []).map((s) => (s.teamId === next.teamId ? next : s)));
  const saveDefault = async (setting: RoutingSetting) => {
    const saved = await putRoutingDefault(t, ws, setting);
    brand.setData(() => saved);
    // teams without an override now show the new default
    teamSettings.setData((list) =>
      (list ?? []).map((s) => (s.inherited ? { ...saved, teamId: s.teamId, inherited: true } : s)),
    );
    return saved;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pf-t--global--spacer--md)' }}>
      <RoutingSettingsCard title="Brand default" setting={brand.data} onSave={saveDefault} />
      {teamSettings.data.map((s) => {
        const team = teams.data?.find((x) => x.id === s.teamId);
        return (
          <RoutingSettingsCard
            key={s.teamId ?? 'default'}
            title={team?.name ?? 'Team'}
            setting={s}
            members={team?.members ?? []}
            onSave={async (setting) => {
              const saved = await putTeamRouting(t, ws, s.teamId as string, setting);
              replaceTeam(saved);
              return saved;
            }}
            onUseDefault={async () => {
              await deleteTeamRouting(t, ws, s.teamId as string);
              replaceTeam({ ...(brand.data as RoutingSetting), teamId: s.teamId, inherited: true });
            }}
          />
        );
      })}
    </div>
  );
};

/** The brand's routing default and each team's override (design §3.4). */
export const RoutingSettingsPage: React.FunctionComponent = () => {
  const allowed = useAccess().hasInWorkspace('inbox:settings');
  // The route is filtered out without the authority; the page says so too in case it is reached another way.
  if (!allowed) return <NotFound />;
  return (
    <PageShell
      title="Inbox routing"
      actions={
        <Button component={(p) => <Link {...p} to="/inbox" />} variant="link">
          Back to the inbox
        </Button>
      }
    >
      <Cards />
    </PageShell>
  );
};
