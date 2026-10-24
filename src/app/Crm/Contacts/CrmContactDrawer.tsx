import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  FormSelect,
  FormSelectOption,
  Label,
  List,
  ListItem,
  Spinner,
} from '@patternfly/react-core';
import { getContact, searchDeals, updateContact } from '@app/api/crm';
import { CardFieldDetails } from '@app/Crm/fields/CardFieldDetails';
import { TaskList } from '@app/Crm/tasks/TaskList';
import { CrmNotes } from '@app/Crm/notes/CrmNotes';
import type { CrmContact, CrmSettings, Ref } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { crmMessage } from '@app/Crm/errors';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { CrmTimeline } from '@app/Crm/activity/CrmTimeline';
import { ChannelChip } from '@app/Crm/common/ChannelChip';
import { RecordDrawer } from '@app/Crm/common/RecordDrawer';
import type { DrawerTab } from '@app/Crm/common/RecordDrawer';
import { formatMoney } from '@app/Crm/common/money';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { useOpenChat } from '@app/Crm/deals/useOpenChat';
import { CrmContactFormModal } from '@app/Crm/Contacts/CrmContactFormModal';
import { MoveChannelModal } from '@app/Crm/Contacts/MoveChannelModal';
import { DELETED_NOTICE, contactName, formatDate, originLine } from '@app/Crm/Contacts/contactColumns';
import { personName } from '@app/Crm/personName';

const UNAVAILABLE = 'This contact is not available. It may have been removed.';
const NEVER = <T,>(): Promise<T> => new Promise<T>(() => undefined);

/** A contact that does not exist loads as null. */
async function fetchContact(token: string, ws: string, id: string): Promise<CrmContact | null> {
  try {
    return await getContact(token, ws, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

const Detail: React.FunctionComponent<{ term: string; children: React.ReactNode }> = ({ term, children }) => (
  <DescriptionListGroup>
    <DescriptionListTerm>{term}</DescriptionListTerm>
    <DescriptionListDescription>{children || '—'}</DescriptionListDescription>
  </DescriptionListGroup>
);

/** The deals the contact is on, each linking to its drawer. */
const ContactDeals: React.FunctionComponent<{ contactId: string; defaultCurrency?: string }> = ({
  contactId,
  defaultCurrency,
}) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const deals = useLoad(
    (t) => searchDeals(t, ws, { crmContactId: contactId, sort: 'lastActivityAt,desc', page: 0, size: 50 }),
    [ws, contactId],
  );
  if (deals.error) return <Alert variant="danger" isInline title={deals.error} />;
  if (!deals.data) return <Spinner aria-label="Loading deals" />;
  if (deals.data.items.length === 0) return <p>No deals yet.</p>;
  return (
    <List isPlain aria-label="Deals of this contact">
      {deals.data.items.map((d) => (
        <ListItem key={d.id}>
          <Link to={`/crm/deals/${d.id}?pipelineId=${encodeURIComponent(d.pipelineId)}`}>{d.title}</Link>{' '}
          <Label isCompact color={d.status === 'WON' ? 'green' : d.status === 'LOST' ? 'red' : 'blue'}>
            {d.status === 'WON' ? 'Won' : d.status === 'LOST' ? 'Lost' : 'Open'}
          </Label>{' '}
          {formatMoney(d.amount, d.currency, defaultCurrency)}
        </ListItem>
      ))}
    </List>
  );
};

/**
 * The drawer of the CRM contact {@code contactId} over {@code children} (the page); closed while there is no id.
 * {@code onChanged} tells the page the contact was edited or moved so it refreshes its list.
 */
export const CrmContactDrawer: React.FunctionComponent<{
  contactId?: string;
  /** Absent while settings load or when they failed: the contact still shows, without the lifecycle and move choices. */
  settings?: CrmSettings;
  owners?: Ref[];
  onChanged(): void;
  onClose(): void;
  children?: React.ReactNode;
}> = ({ contactId, settings, owners = [], onChanged, onClose, children }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const canEdit = useCrmCan('crm:edit');
  const canSettings = useCrmCan('crm:settings');
  const open = useOpenChat();
  const action = useAction();
  const [modal, setModal] = React.useState<'edit' | 'move' | null>(null);

  const loaded = useLoad(
    (t) => (contactId ? fetchContact(t, ws, contactId) : NEVER<CrmContact | null>()),
    [ws, contactId ?? ''],
  );
  // A refetch under an open form would hand it a newer version than the values it was filled from.
  useRefetchOnFocus(() => {
    if (contactId && !modal) loaded.reload();
  });
  React.useEffect(() => {
    setModal(null);
    action.reset();
    open.clearAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const contact = loaded.data ?? undefined;
  const phones = status?.phones ?? [];
  const labelOf = (number: string) => phones.find((p) => p.number === number)?.label;
  const changed = (saved: CrmContact) => {
    loaded.setData(() => saved);
    onChanged();
  };

  const onLifecycle = async (key: string) => {
    if (!contact) return;
    const saved = await action.run(
      () => updateContact(token as string, ws, contact.id, { lifecycleStatus: key, version: contact.version }),
      (e) => {
        if (e instanceof ApiError && e.status === 409 && e.code === 'VERSION_CONFLICT') {
          loaded.reload();
          return 'Someone else changed this contact. It has been refreshed; try again.';
        }
        return crmMessage(e);
      },
    );
    if (saved) changed(saved);
  };

  let title: React.ReactNode = 'Contact';
  let tabs: DrawerTab[];
  let actions: React.ReactNode;
  if (!contactId || loaded.loading) {
    tabs = [{ key: 'details', title: 'Details', content: <Spinner aria-label="Loading contact" /> }];
  } else if (loaded.error) {
    tabs = [{ key: 'details', title: 'Details', content: <Alert variant="danger" isInline title={loaded.error} /> }];
  } else if (!contact) {
    tabs = [{ key: 'details', title: 'Details', content: <Alert variant="warning" isInline title={UNAVAILABLE} /> }];
  } else {
    title = contactName(contact);
    const lifecycles = (settings?.lifecycleStatuses ?? [])
      .filter((l) => l.active || l.key === contact.lifecycleStatus)
      .sort((a, b) => a.position - b.position);
    const lifecycleLabel = lifecycles.find((l) => l.key === contact.lifecycleStatus)?.label ?? contact.lifecycleStatus;
    const canMove =
      canSettings &&
      settings?.allowChannelMove === true &&
      phones.some((p) => p.phoneNumberId !== contact.channel?.phoneNumberId);
    actions = (
      <>
        {canEdit && settings && (
          <Button variant="secondary" onClick={() => setModal('edit')}>
            Edit
          </Button>
        )}{' '}
        <Button
          variant="secondary"
          isLoading={open.busy}
          onClick={() => open.openChat(contact.id, contact.channel?.phoneNumberId)}
        >
          Open chat
        </Button>{' '}
        {canMove && (
          <Button variant="secondary" onClick={() => setModal('move')}>
            Move channel…
          </Button>
        )}
      </>
    );
    const origin = originLine(contact);
    const details = (
      <>
        {contact.contactDeleted && <Alert variant="info" isInline title={DELETED_NOTICE} className="pf-v6-u-mb-md" />}
        {open.alert && (
          <Alert
            variant="warning"
            isInline
            title={open.alert}
            actionClose={<AlertActionCloseButton onClose={open.clearAlert} />}
          />
        )}
        {action.error && <Alert variant="danger" isInline title={action.error} />}
        <DescriptionList isHorizontal isCompact>
          <Detail term="First name">{contact.firstName ?? ''}</Detail>
          <Detail term="Last name">{contact.lastName ?? ''}</Detail>
          <Detail term="WhatsApp number">{contact.phone ?? ''}</Detail>
          <Detail term="Channel">
            {contact.channel ? (
              <ChannelChip number={contact.channel.number} label={labelOf(contact.channel.number)} />
            ) : (
              ''
            )}
          </Detail>
          <Detail term="Email">{contact.email ?? ''}</Detail>
          <Detail term="Job title">{contact.jobTitle ?? ''}</Detail>
          <Detail term="Company">
            {contact.company ? <Link to={`/crm/companies/${contact.company.id}`}>{contact.company.name}</Link> : ''}
          </Detail>
          <Detail term="Owner">{personName(contact.owner)}</Detail>
          <Detail term="Lifecycle">
            {canEdit && lifecycles.length > 0 ? (
              <FormSelect
                aria-label="Lifecycle status"
                value={contact.lifecycleStatus ?? ''}
                isDisabled={action.busy}
                onChange={(_e, v) => onLifecycle(v)}
              >
                {!contact.lifecycleStatus && <FormSelectOption value="" label="No status" isDisabled />}
                {lifecycles.map((l) => (
                  <FormSelectOption key={l.key} value={l.key} label={l.label} />
                ))}
              </FormSelect>
            ) : (
              (lifecycleLabel ?? '')
            )}
          </Detail>
          <Detail term="Source">{contact.source ?? ''}</Detail>
          <Detail term="Origin">{origin}</Detail>
          <Detail term="Channel history">
            {contact.channelHistory.length > 0 && (
              <List isPlain aria-label="Channel history">
                {contact.channelHistory.map((h) => (
                  <ListItem key={`${h.at}-${h.to}`}>
                    {`${formatDate(h.at)}: ${h.from ?? 'none'} to ${h.to ?? 'none'}`}
                    {h.by ? ` by ${personName(h.by)}` : ''}
                    {h.reason ? ` (${h.reason})` : ''}
                  </ListItem>
                ))}
              </List>
            )}
          </Detail>
          <CardFieldDetails entity="CONTACT" values={contact.customFields} />
        </DescriptionList>
      </>
    );
    tabs = [
      { key: 'details', title: 'Details', content: details },
      {
        key: 'tasks',
        title: 'Tasks',
        content: <TaskList target={{ type: 'CONTACT', id: contact.id }} canEdit={canEdit} />,
      },
      {
        key: 'notes',
        title: 'Notes',
        content: <CrmNotes target={{ type: 'CONTACT', id: contact.id }} canEdit={canEdit} />,
      },
      {
        key: 'deals',
        title: 'Deals',
        content: <ContactDeals contactId={contact.id} defaultCurrency={settings?.defaultCurrency} />,
      },
      {
        key: 'timeline',
        title: 'Timeline',
        content: <CrmTimeline target={{ type: 'CONTACT', id: contact.id }} canLog={canEdit} />,
      },
    ];
  }

  return (
    <>
      <RecordDrawer isOpen={!!contactId} title={title} actions={actions} tabs={tabs} onClose={onClose}>
        {children}
      </RecordDrawer>
      {modal === 'edit' && contact && settings && (
        <CrmContactFormModal
          contact={contact}
          settings={settings}
          owners={owners}
          onConflict={() => loaded.reload()}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null);
            changed(saved);
          }}
        />
      )}
      {modal === 'move' && contact && (
        <MoveChannelModal
          contact={contact}
          numbers={phones}
          onConflict={() => loaded.reload()}
          onClose={() => setModal(null)}
          onMoved={(saved) => {
            setModal(null);
            changed(saved);
          }}
        />
      )}
    </>
  );
};
