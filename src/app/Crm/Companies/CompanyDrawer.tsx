import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@patternfly/react-core';
import { companySummary, deleteCompany } from '@app/api/crm';
import { CardFieldDetails } from '@app/Crm/fields/CardFieldDetails';
import type { Company, CompanySummary, CrmSettings, Ref } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { crmMessage } from '@app/Crm/errors';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { CrmTimeline } from '@app/Crm/activity/CrmTimeline';
import { RecordDrawer } from '@app/Crm/common/RecordDrawer';
import type { DrawerTab } from '@app/Crm/common/RecordDrawer';
import { formatMoney } from '@app/Crm/common/money';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';
import { CompanyFormModal } from '@app/Crm/Companies/CompanyFormModal';
import { contactName, formatDate } from '@app/Crm/Contacts/contactColumns';

export const OPEN_DEALS_MESSAGE = 'This company still has open deals. Close or move them first.';
const UNAVAILABLE = 'This company is not available. It may have been removed.';
const NEVER = <T,>(): Promise<T> => new Promise<T>(() => undefined);

/** A company that does not exist loads as null. */
async function fetchSummary(token: string, ws: string, id: string): Promise<CompanySummary | null> {
  try {
    return await companySummary(token, ws, id);
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

const addressLine = (c: Company): string =>
  [c.address?.line1, c.address?.city, c.address?.state, c.address?.postalCode, c.address?.country]
    .filter(Boolean)
    .join(', ');

/**
 * The drawer of the company {@code companyId} over {@code children} (the page); closed while there is no id.
 * {@code onChanged} tells the page the company was edited or deleted so it refreshes its list.
 */
export const CompanyDrawer: React.FunctionComponent<{
  companyId?: string;
  settings?: CrmSettings;
  owners?: Ref[];
  onChanged(): void;
  onClose(): void;
  children?: React.ReactNode;
}> = ({ companyId, settings, owners = [], onChanged, onClose, children }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canEdit = useCrmCan('crm:edit');
  const canDelete = useCrmCan('crm:delete') && canEdit;
  const action = useAction();
  const [modal, setModal] = React.useState<'edit' | 'delete' | null>(null);

  const loaded = useLoad(
    (t) => (companyId ? fetchSummary(t, ws, companyId) : NEVER<CompanySummary | null>()),
    [ws, companyId ?? ''],
  );
  // A refetch under an open form would hand it a newer version than the values it was filled from.
  useRefetchOnFocus(() => {
    if (companyId && !modal) loaded.reload();
  });
  React.useEffect(() => {
    setModal(null);
    action.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const summary = loaded.data ?? undefined;
  const company = summary?.company;
  const currency = settings?.defaultCurrency;

  const onDelete = async () => {
    if (!company) return;
    const done = await action.run(
      async () => {
        await deleteCompany(token as string, ws, company.id);
        return true;
      },
      (e) => (e instanceof ApiError && e.code === 'COMPANY_HAS_OPEN_DEALS' ? OPEN_DEALS_MESSAGE : crmMessage(e)),
    );
    if (done) {
      setModal(null);
      onChanged();
      onClose();
    }
  };

  let title: React.ReactNode = 'Company';
  let tabs: DrawerTab[];
  let actions: React.ReactNode;
  if (!companyId || loaded.loading) {
    tabs = [{ key: 'details', title: 'Details', content: <Spinner aria-label="Loading company" /> }];
  } else if (loaded.error) {
    tabs = [{ key: 'details', title: 'Details', content: <Alert variant="danger" isInline title={loaded.error} /> }];
  } else if (!summary || !company) {
    tabs = [{ key: 'details', title: 'Details', content: <Alert variant="warning" isInline title={UNAVAILABLE} /> }];
  } else {
    title = company.name;
    const industryLabel = company.industry
      ? (settings?.industries.find((i) => i.key === company.industry)?.label ?? company.industry)
      : '';
    actions = (
      <>
        {canEdit && (
          <Button variant="secondary" onClick={() => setModal('edit')}>
            Edit
          </Button>
        )}{' '}
        {canDelete && (
          <Button
            variant="danger"
            onClick={() => {
              action.reset();
              setModal('delete');
            }}
          >
            Delete
          </Button>
        )}
      </>
    );
    const details = (
      <DescriptionList isHorizontal isCompact>
        <Detail term="Contacts">{String(summary.contactCount)}</Detail>
        <Detail term="Open deal amount">{formatMoney(summary.openDealAmount, null, currency) || '0'}</Detail>
        <Detail term="Domain">{company.domain ?? ''}</Detail>
        <Detail term="Website">{company.website ?? ''}</Detail>
        <Detail term="Industry">{industryLabel}</Detail>
        <Detail term="Size">{company.size ?? ''}</Detail>
        <Detail term="Annual revenue">{formatMoney(company.annualRevenue, null, currency)}</Detail>
        <Detail term="Phone">{company.phone ?? ''}</Detail>
        <Detail term="Email">{company.email ?? ''}</Detail>
        <Detail term="Address">{addressLine(company)}</Detail>
        <Detail term="Description">{company.description ?? ''}</Detail>
        <Detail term="Owner">{company.owner?.name ?? ''}</Detail>
        <Detail term="Created">{formatDate(company.creationTime)}</Detail>
        <CardFieldDetails entity="COMPANY" values={company.customFields} />
      </DescriptionList>
    );
    const contacts =
      summary.contacts.length === 0 ? (
        <p>No contacts yet.</p>
      ) : (
        <List isPlain aria-label="Contacts of this company">
          {summary.contacts.map((c) => (
            <ListItem key={c.id}>
              <Link to={`/crm/contacts/${c.id}`}>{contactName(c)}</Link>
              {c.jobTitle ? ` · ${c.jobTitle}` : ''}
            </ListItem>
          ))}
        </List>
      );
    const deals =
      summary.openDeals.length === 0 ? (
        <p>No open deals.</p>
      ) : (
        <List isPlain aria-label="Open deals of this company">
          {summary.openDeals.map((d) => (
            <ListItem key={d.id}>
              <Link to={`/crm/deals/${d.id}?pipelineId=${encodeURIComponent(d.pipelineId)}`}>{d.title}</Link>{' '}
              <Label isCompact color="blue">
                Open
              </Label>{' '}
              {formatMoney(d.amount, d.currency, currency)}
            </ListItem>
          ))}
        </List>
      );
    tabs = [
      { key: 'details', title: 'Details', content: details },
      { key: 'contacts', title: 'Contacts', content: contacts },
      { key: 'deals', title: 'Deals', content: deals },
      {
        key: 'timeline',
        title: 'Timeline',
        content: <CrmTimeline target={{ type: 'COMPANY', id: company.id }} canLog={canEdit} />,
      },
    ];
  }

  return (
    <>
      <RecordDrawer isOpen={!!companyId} title={title} actions={actions} tabs={tabs} onClose={onClose}>
        {children}
      </RecordDrawer>
      {modal === 'edit' && company && (
        <CompanyFormModal
          company={company}
          settings={settings}
          owners={owners}
          onConflict={() => loaded.reload()}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null);
            loaded.setData((cur) => (cur ? { ...cur, company: saved } : cur));
            onChanged();
          }}
        />
      )}
      {modal === 'delete' && company && (
        <Modal isOpen variant="small" onClose={() => setModal(null)} aria-labelledby="crm-company-delete-title">
          <ModalHeader title="Delete company?" labelId="crm-company-delete-title" />
          <ModalBody>
            {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
            {`${company.name} will be removed. Its contacts and deals stay, without a company.`}
          </ModalBody>
          <ModalFooter>
            <Button variant="danger" isDisabled={action.busy} isLoading={action.busy} onClick={onDelete}>
              Delete company
            </Button>
            <Button variant="link" onClick={() => setModal(null)}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
};
