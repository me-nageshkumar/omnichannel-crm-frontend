import * as React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  Label,
  Pagination,
  Spinner,
  Stack,
  StackItem,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { CAMPAIGN_PAGE_SIZE, CampaignCounts, RecipientStatus, SenderView, listRecipients } from '@app/api/campaigns';
import { shown } from '@app/api/phoneNumbers';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { CampaignStatusLabel } from '@app/Campaigns/CampaignStatusLabel';
import { systemPauseText } from '@app/Campaigns/CampaignsPage';
import { RECIPIENT_STATUS_TEXT, SKIP_REASON_TEXT, estimateText } from '@app/Campaigns/campaignDisplay';
import { RefreshCountdown } from '@app/Campaigns/RefreshCountdown';
import { SenderStateLabel, pauseText } from '@app/Campaigns/senderDisplay';
import { useCampaignActions } from '@app/Campaigns/useCampaignActions';
import { useCampaignProgress } from '@app/Campaigns/useCampaignProgress';
import { PhoneStatusLabel, relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';

const BLUE = 'var(--pf-t--global--color--brand--default)';
const BORDER = 'var(--pf-t--global--border--color--default)';

const COUNTS: Array<{ key: keyof CampaignCounts; term: string; hint: string; color: string }> = [
  { key: 'total', term: 'Total', hint: 'Everyone in the audience.', color: BORDER },
  { key: 'pending', term: 'Pending', hint: 'Not sent yet.', color: BORDER },
  { key: 'sent', term: 'Sent', hint: 'Handed to WhatsApp by a sender number.', color: BLUE },
  { key: 'delivered', term: 'Delivered', hint: 'Reached the recipient’s phone.', color: BLUE },
  { key: 'read', term: 'Read', hint: 'Opened by the recipient.', color: BLUE },
  {
    key: 'replied',
    term: 'Replied',
    hint: 'The recipient wrote back.',
    color: 'var(--pf-t--global--color--status--success--default)',
  },
  {
    key: 'skipped',
    term: 'Skipped',
    hint: 'Not sent, for example not on WhatsApp or messaged recently.',
    color: 'var(--pf-t--global--icon--color--subtle)',
  },
  {
    key: 'failed',
    term: 'Failed',
    hint: 'WhatsApp did not take the message.',
    color: 'var(--pf-t--global--color--status--danger--default)',
  },
];

const STATUS_COLOR: Record<RecipientStatus, 'grey' | 'blue' | 'green' | 'red'> = {
  PENDING: 'grey',
  SENDING: 'blue',
  SENT: 'blue',
  DELIVERED: 'blue',
  READ: 'green',
  FAILED: 'red',
  SKIPPED: 'grey',
};

const STATUSES = Object.keys(RECIPIENT_STATUS_TEXT) as RecipientStatus[];
const SHOWS_ESTIMATE = ['DRAFT', 'RUNNING', 'PAUSED'];

const when = (iso: string | null) => (iso ? relative(iso) : '—');

const Counts: React.FunctionComponent<{ counts: CampaignCounts }> = ({ counts }) => (
  <DescriptionList isCompact isAutoFit autoFitMinModifier={{ default: '90px' }} aria-label="Counts">
    {COUNTS.map(({ key, term, hint, color }) => (
      <DescriptionListGroup key={key} style={{ borderTop: `3px solid ${color}`, paddingTop: 8 }}>
        <DescriptionListTerm>
          <Tooltip content={hint}>
            <span tabIndex={0}>{term}</span>
          </Tooltip>
        </DescriptionListTerm>
        <DescriptionListDescription>{counts[key]}</DescriptionListDescription>
      </DescriptionListGroup>
    ))}
  </DescriptionList>
);

const SendersToday: React.FunctionComponent<{ senders: SenderView[] }> = ({ senders }) => (
  <Table aria-label="Senders today" variant="compact">
    <Thead>
      <Tr>
        <Th>Number</Th>
        <Th>State</Th>
        <Th>Cap today</Th>
        <Th>Used today</Th>
        <Th>Phone status</Th>
        <Th>Pause</Th>
      </Tr>
    </Thead>
    <Tbody>
      {senders.map((s) => (
        <Tr key={s.phoneNumberId}>
          <Td dataLabel="Number">{shown(s.number)}</Td>
          <Td dataLabel="State">
            <SenderStateLabel sender={s} />
          </Td>
          <Td dataLabel="Cap today">{s.capToday}</Td>
          <Td dataLabel="Used today">{s.usedToday}</Td>
          <Td dataLabel="Phone status">
            <PhoneStatusLabel status={s.phoneStatus} />
          </Td>
          <Td dataLabel="Pause">{pauseText(s) ?? '—'}</Td>
        </Tr>
      ))}
    </Tbody>
  </Table>
);

/** The campaign's recipients, fetched again after each refresh of the campaign (rows stay meanwhile). */
const Recipients: React.FunctionComponent<{ id: string; refreshedAt: Date | null }> = ({ id, refreshedAt }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [status, setStatus] = React.useState<RecipientStatus | ''>('');
  const [page, setPage] = React.useState(0);
  const recipients = useLoad(
    (tk) => listRecipients(tk, ws, id, { status: status || undefined, page }),
    [ws, id, status, page],
  );
  const { reload } = recipients;
  // The first refresh is the load the table made itself; later ones bring new rows.
  const firstRefresh = React.useRef<Date | null>(null);
  React.useEffect(() => {
    if (!refreshedAt) {
      firstRefresh.current = null;
    } else if (!firstRefresh.current) {
      firstRefresh.current = refreshedAt;
    } else {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshedAt]);
  const data = recipients.data;
  const items = data?.items ?? [];

  return (
    <>
      <Title headingLevel="h2" size="md">
        Recipients
      </Title>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <FormSelect
              aria-label="Status"
              value={status}
              onChange={(_e, v) => {
                setStatus(v as RecipientStatus | '');
                setPage(0);
              }}
            >
              <FormSelectOption value="" label="All" />
              {STATUSES.map((s) => (
                <FormSelectOption key={s} value={s} label={RECIPIENT_STATUS_TEXT[s]} />
              ))}
            </FormSelect>
          </ToolbarItem>
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
      {recipients.error && <Alert variant="danger" isInline title={recipients.error} />}
      {recipients.loading && !data ? (
        <Spinner aria-label="Loading recipients" />
      ) : (
        <Table aria-label="Recipients" variant="compact">
          <Thead>
            <Tr>
              <Th>Phone</Th>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Skip reason</Th>
              <Th>Sender</Th>
              <Th>Sent</Th>
              <Th>Replied</Th>
              <Th>Error</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <Tr>
                <Td colSpan={8}>No recipients.</Td>
              </Tr>
            ) : (
              items.map((r) => (
                <Tr key={r.id}>
                  <Td dataLabel="Phone">{shown(r.phone)}</Td>
                  <Td dataLabel="Name">{r.contactName ?? '—'}</Td>
                  <Td dataLabel="Status">
                    <Label color={STATUS_COLOR[r.status]}>{RECIPIENT_STATUS_TEXT[r.status]}</Label>
                  </Td>
                  <Td dataLabel="Skip reason">{r.skipReason ? SKIP_REASON_TEXT[r.skipReason] : '—'}</Td>
                  <Td dataLabel="Sender">{r.senderNumber ? shown(r.senderNumber) : '—'}</Td>
                  <Td dataLabel="Sent">{when(r.sentAt)}</Td>
                  <Td dataLabel="Replied">{when(r.repliedAt)}</Td>
                  <Td dataLabel="Error" modifier="truncate">
                    {r.error ? (
                      <Tooltip content={r.error}>
                        <span tabIndex={0}>{r.error}</span>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      )}
    </>
  );
};

/** One campaign: its counts, refreshed every few seconds while it runs, its senders and recipients. */
export const CampaignDetailPage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const startError = (useLocation().state as { startError?: string } | null)?.startError;
  const progress = useCampaignProgress(id);
  const actions = useCampaignActions((act) => (act === 'delete' ? navigate('/campaigns') : progress.refresh()));
  const c = progress.campaign;
  const estimate = c && SHOWS_ESTIMATE.includes(c.status) ? estimateText(c.estimate) : null;

  return (
    <PageShell
      title={c?.name ?? 'Campaign'}
      actions={
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          {c && actions.buttonsFor(c)}
          <Button component={(p) => <Link {...p} to="/campaigns" />} variant="link">
            Back to campaigns
          </Button>
        </Flex>
      }
    >
      <Stack hasGutter>
        {startError && (
          <StackItem>
            <Alert variant="danger" isInline title={startError} />
          </StackItem>
        )}
        {actions.error && (
          <StackItem>
            <Alert variant="danger" isInline title={actions.error} />
          </StackItem>
        )}
        {!c ? (
          <StackItem>
            {progress.error ? <RefreshCountdown progress={progress} /> : <Spinner aria-label="Loading campaign" />}
          </StackItem>
        ) : (
          <>
            {c.pausedBy === 'SYSTEM' && (
              <StackItem>
                <Alert variant="warning" isInline title={systemPauseText(c.pauseReason)} />
              </StackItem>
            )}
            <StackItem>
              <Flex spaceItems={{ default: 'spaceItemsMd' }} alignItems={{ default: 'alignItemsCenter' }}>
                <CampaignStatusLabel status={c.status} />
                {estimate && <Content component="p">{estimate}</Content>}
              </Flex>
            </StackItem>
            <StackItem>
              <Flex
                justifyContent={{ default: 'justifyContentSpaceBetween' }}
                alignItems={{ default: 'alignItemsFlexStart' }}
                flexWrap={{ default: 'wrap' }}
              >
                <FlexItem grow={{ default: 'grow' }}>
                  <Counts counts={c.counts} />
                </FlexItem>
                <FlexItem>
                  <RefreshCountdown progress={progress} />
                </FlexItem>
              </Flex>
            </StackItem>
            <StackItem>
              <Title headingLevel="h2" size="md">
                Senders today
              </Title>
              <SendersToday senders={c.senders} />
            </StackItem>
            <StackItem>
              <Recipients id={id} refreshedAt={progress.refreshedAt} />
            </StackItem>
          </>
        )}
      </Stack>
      {actions.modal}
    </PageShell>
  );
};
