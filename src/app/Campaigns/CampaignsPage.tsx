import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Content,
  Pagination,
  Progress,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { CAMPAIGN_PAGE_SIZE, CampaignView, listCampaigns } from '@app/api/campaigns';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { CampaignStatusLabel } from '@app/Campaigns/CampaignStatusLabel';
import { useCampaignActions } from '@app/Campaigns/useCampaignActions';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

export const SYSTEM_PAUSE_TEXT =
  'Campaigns were paused after two numbers were logged out this week. Review the senders before resuming.';
const GENERIC_PAUSE_TEXT = 'A campaign was paused by the system. Open it to see why, then resume it.';
const REFUSED_TEXT =
  'Sending was refused for this campaign, for example because a template was archived. Fix the campaign, then resume it.';

/** The sentence explaining why the system paused a campaign. */
export function systemPauseText(reason: string | null): string {
  return reason === 'SEND_REFUSED' ? REFUSED_TEXT : SYSTEM_PAUSE_TEXT;
}

function audienceText(c: CampaignView): string {
  const a = c.audience;
  return a.kind === 'FILTER' ? `Saved filter: ${a.filterName ?? '—'}` : `CSV: ${a.csvFileName ?? '—'} (${a.csvRows ?? 0} rows)`;
}

/** The brand's campaigns with their progress and lifecycle actions. */
export const CampaignsPage: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const access = useAccess();
  const canManage = access.hasInWorkspace('campaign:manage');
  const canSettings = access.hasInWorkspace('campaign:settings');
  const [page, setPage] = React.useState(0);
  const campaigns = useLoad((tk) => listCampaigns(tk, ws, { page }), [ws, page]);
  const actions = useCampaignActions(() => campaigns.reload());
  const data = campaigns.data;
  const items = data?.items ?? [];

  return (
    <PageShell
      title="Campaigns"
      actions={
        <>
          {canManage && (
            <Button component={(p) => <Link {...p} to="/campaigns/new" />} variant="primary" style={{ marginRight: 8 }}>
              New campaign
            </Button>
          )}
          <Button component={(p) => <Link {...p} to="/campaigns/senders" />} variant="secondary">
            Senders
          </Button>
          {canSettings && (
            <Button
              component={(p) => <Link {...p} to="/campaigns/settings" />}
              variant="secondary"
              style={{ marginLeft: 8 }}
            >
              Campaign settings
            </Button>
          )}
        </>
      }
    >
      {data?.systemPaused && (
        <Alert
          variant="warning"
          isInline
          title={items.some((c) => c.pauseReason === 'TWO_LOGOUTS') ? SYSTEM_PAUSE_TEXT : GENERIC_PAUSE_TEXT}
        />
      )}
      {actions.error && <Alert variant="danger" isInline title={actions.error} />}
      {campaigns.error && <Alert variant="danger" isInline title={campaigns.error} />}
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={data?.total ?? 0}
              perPage={CAMPAIGN_PAGE_SIZE}
              perPageOptions={[{ title: String(CAMPAIGN_PAGE_SIZE), value: CAMPAIGN_PAGE_SIZE }]}
              page={page + 1}
              onSetPage={(_e, p) => setPage(p - 1)}
              isCompact
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {campaigns.loading && !data ? (
        <Spinner aria-label="Loading campaigns" />
      ) : (
        <Table aria-label="Campaigns" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Replied</Th>
              <Th>Skipped</Th>
              <Th>Started</Th>
              {canManage && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <Tr>
                <Td colSpan={canManage ? 7 : 6}>No campaigns yet.</Td>
              </Tr>
            ) : (
              items.map((c) => {
                const menu = actions.menuFor(c);
                return (
                  <Tr key={c.id}>
                    <Td dataLabel="Name">
                      <Link to={`/campaigns/${c.id}`}>{c.name}</Link>
                      <Content component="small" style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
                        {audienceText(c)}
                      </Content>
                    </Td>
                    <Td dataLabel="Status">
                      <CampaignStatusLabel status={c.status} />
                    </Td>
                    <Td dataLabel="Progress">
                      <Progress
                        size="sm"
                        measureLocation="outside"
                        value={c.counts.total === 0 ? 0 : (c.counts.sent / c.counts.total) * 100}
                        label={`${c.counts.sent} / ${c.counts.total}`}
                        aria-label={`Progress of ${c.name}`}
                      />
                    </Td>
                    <Td dataLabel="Replied">{c.counts.replied}</Td>
                    <Td dataLabel="Skipped">{c.counts.skipped}</Td>
                    <Td dataLabel="Started">{c.startedAt ? relative(c.startedAt) : '—'}</Td>
                    {canManage && <Td isActionCell>{menu.length > 0 && <ActionsColumn items={menu} />}</Td>}
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      )}
      {actions.modal}
    </PageShell>
  );
};
