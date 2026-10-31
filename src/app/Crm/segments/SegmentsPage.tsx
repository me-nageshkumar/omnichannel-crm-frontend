import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  Popover,
  SearchInput,
  Spinner,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { LockIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { deleteSegment, listSegments } from '@app/api/crm';
import type { CachedCounts, CrmPhone, Segment } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { crmMessage } from '@app/Crm/errors';

export const PERMISSION_TEXT = 'You need the Segments permission';
export const EMPTY_TEXT = 'No segments yet';

const n = (v: number) => v.toLocaleString('en-US');
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** "n CRM contacts", with the people in brackets when they differ (spec C20). */
export function countsText(c: CachedCounts): string {
  const base = `${n(c.total)} CRM contacts`;
  return c.people === c.total ? base : `${base} (${n(c.people)} people)`;
}

/** The label of a channel account: the number's label, else its number, else the id. */
export function accountLabel(id: string | null, phones: CrmPhone[]): string {
  if (id === null) return 'No channel account';
  const p = phones.find((x) => x.phoneNumberId === id);
  return p?.label ?? p?.number ?? id;
}

const Audience: React.FunctionComponent<{ segment: Segment; phones: CrmPhone[] }> = ({ segment: s, phones }) => {
  const c = s.cachedCounts;
  if (!c) return <span>Not counted yet</span>;
  return (
    <div>
      <div>{countsText(c)}</div>
      <div className="pf-v6-u-font-size-sm pf-v6-u-color-200">
        as of {when(c.at)}
        {c.truncated ? ' · first 50,000 only' : ''}
        {' · '}
        <Popover
          headerContent="Per channel account"
          bodyContent={
            <Table variant="compact" aria-label={`Channel accounts of ${s.name}`} borders={false}>
              <Tbody>
                {c.channelAccounts.map((row) => (
                  <Tr key={row.channelAccountId ?? 'none'}>
                    <Td>{accountLabel(row.channelAccountId, phones)}</Td>
                    <Td>{n(row.count)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          }
        >
          <Button variant="link" isInline aria-label={`Per channel account of ${s.name}`}>
            {c.channelAccounts.length === 1 ? '1 channel account' : `${c.channelAccounts.length} channel accounts`}
          </Button>
        </Popover>
      </div>
    </div>
  );
};

/** The brand's saved segments (spec C17): who they are, how many, when last sent, and the way to a campaign. */
export const SegmentsPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canUse = useCrmCan('crm:segments');
  const canSend = useAccess().hasInWorkspace('campaign:manage');
  const phones = useCrmStatus().status?.phones ?? [];
  const [search, setSearch] = React.useState('');
  const [deleting, setDeleting] = React.useState<Segment | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const list = useLoad((tk) => (canUse ? listSegments(tk, ws) : Promise.resolve<Segment[]>([])), [ws, canUse]);
  useRefetchOnFocus(() => list.reload());

  if (!canUse) {
    return (
      <PageSection hasBodyWrapper={false}>
        <EmptyState titleText={PERMISSION_TEXT} headingLevel="h1" icon={LockIcon}>
          <EmptyStateBody>Ask your admin to add it to your role.</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  const confirmDelete = async () => {
    if (!deleting || !token) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteSegment(token, ws, deleting.id);
      setDeleting(null);
      list.reload();
    } catch (e) {
      setDeleteError(
        e instanceof ApiError && e.code === 'SEGMENT_IN_USE' ? (e.serverMessage ?? e.message) : crmMessage(e),
      );
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));

  let body: React.ReactNode;
  if (list.error) body = <Alert variant="danger" isInline title={list.error} />;
  else if (!list.data) body = <Spinner aria-label="Loading segments" />;
  else if (list.data.length === 0) body = <EmptyState headingLevel="h2" titleText={EMPTY_TEXT} />;
  else
    body = (
      <Table aria-label="Segments" variant="compact">
        <Thead>
          <Tr>
            <Th>Segment</Th>
            <Th>Audience</Th>
            <Th>Last sent</Th>
            <Th screenReaderText="Actions" />
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((s) => (
            <Tr key={s.id}>
              <Td dataLabel="Segment">
                <Link to={`/crm/segments/${s.id}`}>{s.name}</Link>
                {s.description && <div className="pf-v6-u-font-size-sm pf-v6-u-color-200">{s.description}</div>}
              </Td>
              <Td dataLabel="Audience">
                <Audience segment={s} phones={phones} />
              </Td>
              <Td dataLabel="Last sent">
                {s.lastCampaignId && s.lastCampaignName ? (
                  <>
                    <Link to={`/campaigns/${s.lastCampaignId}`}>{s.lastCampaignName}</Link>
                    {s.lastSentAt && <div className="pf-v6-u-font-size-sm pf-v6-u-color-200">{when(s.lastSentAt)}</div>}
                  </>
                ) : (
                  'Never'
                )}
              </Td>
              <Td dataLabel="Actions" isActionCell>
                <Button variant="link" isInline component={(props) => <Link {...props} to={`/crm/segments/${s.id}`} />}>
                  Edit
                </Button>
                {canSend && (
                  <Button
                    variant="link"
                    isInline
                    className="pf-v6-u-ml-md"
                    component={(props) => <Link {...props} to={`/campaigns/new?segmentId=${s.id}`} />}
                  >
                    Send campaign
                  </Button>
                )}
                <Button
                  variant="link"
                  isInline
                  isDanger
                  className="pf-v6-u-ml-md"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(s);
                  }}
                >
                  Delete
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    );

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">Segments</Title>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                aria-label="Search segments"
                value={search}
                onChange={(_e, v) => setSearch(v)}
                onClear={() => setSearch('')}
              />
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignEnd' }}>
              <Button variant="primary" component={(props) => <Link {...props} to="/crm/segments/new" />}>
                New segment
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
        {body}
      </PageSection>
      {deleting && (
        <Modal isOpen variant="small" onClose={() => setDeleting(null)} aria-labelledby="delete-segment-title">
          <ModalHeader title="Delete segment?" labelId="delete-segment-title" titleIconVariant="warning" />
          <ModalBody>
            {`"${deleting.name}" will be removed. Campaigns already sent and timeline entries stay.`}
            {deleteError && <Alert variant="danger" isInline title={deleteError} className="pf-v6-u-mt-md" />}
          </ModalBody>
          <ModalFooter>
            <Button variant="danger" onClick={confirmDelete} isDisabled={busy} isLoading={busy}>
              Delete
            </Button>
            <Button variant="link" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
};
