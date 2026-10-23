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
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@patternfly/react-core';
import { deleteDeal, getDeal, moveDeal } from '@app/api/crm';
import type { CrmSettings, Deal, Pipeline } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { isCode } from '@app/Crm/Settings/ConflictAlert';
import { useSession } from '@app/session/SessionContext';
import { CrmTimeline } from '@app/Crm/activity/CrmTimeline';
import { ChannelChip } from '@app/Crm/common/ChannelChip';
import { RecordDrawer } from '@app/Crm/common/RecordDrawer';
import { formatMoney } from '@app/Crm/common/money';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { CloseDealModal } from '@app/Crm/deals/CloseDealModal';
import { DealFormModal } from '@app/Crm/deals/DealFormModal';
import { useOpenChat } from '@app/Crm/deals/useOpenChat';
import { moveMessage } from '@app/Crm/deals/moveMessage';

const UNAVAILABLE = "This deal is not available. It may have been deleted or moved to a pipeline you can't see.";
const NEVER = <T,>(): Promise<T> => new Promise<T>(() => undefined);

/** A deal that does not exist (or is not for this user to see) loads as null. */
async function fetchDeal(token: string, ws: string, id: string): Promise<Deal | null> {
  try {
    return await getDeal(token, ws, id);
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

/**
 * The drawer of the deal {@code dealId} over {@code children} (the page); closed while there is no id.
 * {@code onChanged} tells the page the deal was moved, closed, edited or deleted so it refreshes its board.
 */
export const DealDrawer: React.FunctionComponent<{
  dealId?: string;
  pipelines: Pipeline[];
  /** Absent while settings load or when they failed: the deal still shows, without edit and lost-reason labels. */
  settings?: CrmSettings;
  onChanged(): void;
  onClose(): void;
  children?: React.ReactNode;
}> = ({ dealId, pipelines, settings, onChanged, onClose, children }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const canEdit = useCrmCan('crm:edit');
  const canDelete = useCrmCan('crm:delete') && canEdit;
  const open = useOpenChat();
  const action = useAction();
  const [modal, setModal] = React.useState<'edit' | 'close' | 'delete' | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const loaded = useLoad(
    (t) => (dealId ? fetchDeal(t, ws, dealId) : NEVER<Deal | null>()),
    [ws, dealId ?? ''],
  );
  React.useEffect(() => {
    setModal(null);
    setNotice(null);
    action.reset();
    open.clearAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const deal = loaded.data ?? undefined;
  const pipeline = pipelines.find((p) => p.id === deal?.pipelineId);
  const phone = status?.phones.find((p) => p.phoneNumberId === deal?.channel?.phoneNumberId);
  const reasonLabels = Object.fromEntries((settings?.lostReasons ?? []).map((r) => [r.key, r.label]));

  const changed = (saved: Deal) => {
    loaded.setData(() => saved);
    onChanged();
  };

  const onStage = async (stageId: string) => {
    if (!deal) return;
    setNotice(null);
    const moved = await action.run(
      () => moveDeal(token as string, ws, deal.id, { stageId }),
      (e) => {
        // The shown stage is stale: fetch the deal as it is now.
        if (isCode(e, 'VERSION_CONFLICT')) loaded.reload();
        return moveMessage(e);
      },
    );
    if (moved) changed(moved);
  };

  const onDelete = async () => {
    if (!deal) return;
    const done = await action.run(async () => {
      await deleteDeal(token as string, ws, deal.id);
      return true;
    });
    if (done) {
      setModal(null);
      onChanged();
      onClose();
    }
  };

  let title: React.ReactNode = 'Deal';
  let tabs;
  let actions: React.ReactNode;
  if (!dealId || loaded.loading) {
    tabs = [{ key: 'details', title: 'Details', content: <Spinner aria-label="Loading deal" /> }];
  } else if (loaded.error) {
    tabs = [{ key: 'details', title: 'Details', content: <Alert variant="danger" isInline title={loaded.error} /> }];
  } else if (!deal) {
    tabs = [{ key: 'details', title: 'Details', content: <Alert variant="warning" isInline title={UNAVAILABLE} /> }];
  } else {
    title = deal.title;
    const stage = pipeline?.stages.find((s) => s.id === deal.stageId);
    const contact = deal.primaryContact;
    actions = (
      <>
        {canEdit && pipeline && settings && (
          <Button variant="secondary" onClick={() => setModal('edit')}>
            Edit
          </Button>
        )}{' '}
        {contact && (
          <Button
            variant="secondary"
            isLoading={open.busy}
            onClick={() => open.openChat(contact.id, deal.channel?.phoneNumberId)}
          >
            Open chat
          </Button>
        )}{' '}
        {canEdit && deal.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => setModal('close')}>
            Close deal
          </Button>
        )}{' '}
        {canDelete && (
          <Button variant="danger" onClick={() => setModal('delete')}>
            Delete
          </Button>
        )}
      </>
    );
    const details = (
      <>
        {open.alert && <Alert variant="warning" isInline title={open.alert} actionClose={<AlertActionCloseButton onClose={open.clearAlert} />} />}
        {(notice || action.error) && <Alert variant="danger" isInline title={notice ?? action.error} />}
        <DescriptionList isHorizontal isCompact>
          <Detail term="Status">
            <Label isCompact color={deal.status === 'WON' ? 'green' : deal.status === 'LOST' ? 'red' : 'blue'}>
              {deal.status === 'WON' ? 'Won' : deal.status === 'LOST' ? 'Lost' : 'Open'}
            </Label>
            {deal.lostReason && ` ${reasonLabels[deal.lostReason] ?? deal.lostReason}`}
          </Detail>
          <Detail term="Stage">
            {canEdit && pipeline ? (
              <FormSelect
                aria-label="Stage"
                value={deal.stageId}
                isDisabled={action.busy}
                onChange={(_e, v) => onStage(v)}
              >
                {pipeline.stages.map((s) => (
                  <FormSelectOption key={s.id} value={s.id} label={s.name} />
                ))}
              </FormSelect>
            ) : (
              (stage?.name ?? '')
            )}
          </Detail>
          <Detail term="Amount">{formatMoney(deal.amount, deal.currency, settings?.defaultCurrency)}</Detail>
          <Detail term="Probability">{deal.probability == null ? '' : `${deal.probability}%`}</Detail>
          <Detail term="Expected close">{deal.expectedCloseDate ?? ''}</Detail>
          <Detail term="Contact">
            {contact ? <Link to={`/crm/contacts/${contact.id}`}>{contact.name || contact.phone || 'Contact'}</Link> : ''}
          </Detail>
          <Detail term="Company">
            {deal.company ? <Link to={`/crm/companies/${deal.company.id}`}>{deal.company.name}</Link> : ''}
          </Detail>
          <Detail term="Number">
            {deal.channel ? <ChannelChip number={deal.channel.number} label={phone?.label} /> : ''}
          </Detail>
          <Detail term="Owner">{deal.owner?.name ?? ''}</Detail>
          <Detail term="Source">{deal.source ?? ''}</Detail>
        </DescriptionList>
      </>
    );
    tabs = [
      { key: 'details', title: 'Details', content: details },
      {
        key: 'timeline',
        title: 'Timeline',
        content: (
          <CrmTimeline
            target={{ type: 'DEAL', id: deal.id }}
            canLog={canEdit}
            stages={pipeline?.stages}
            reasonLabels={reasonLabels}
          />
        ),
      },
    ];
  }

  return (
    <>
      <RecordDrawer isOpen={!!dealId} title={title} actions={actions} tabs={tabs} onClose={onClose}>
        {children}
      </RecordDrawer>
      {modal === 'edit' && deal && pipeline && settings && (
        <DealFormModal
          deal={deal}
          pipeline={pipeline}
          settings={settings}
          onClose={() => setModal(null)}
          onConflict={() => loaded.reload()}
          onSaved={(saved) => {
            setModal(null);
            changed(saved);
          }}
        />
      )}
      {modal === 'close' && deal && (
        <CloseDealModal
          deal={deal}
          lostReasons={settings?.lostReasons ?? []}
          onClose={() => setModal(null)}
          onClosed={(saved) => {
            setModal(null);
            changed(saved);
          }}
        />
      )}
      {modal === 'delete' && deal && (
        <Modal isOpen variant="small" onClose={() => setModal(null)} aria-labelledby="crm-delete-title">
          <ModalHeader title="Delete this deal?" labelId="crm-delete-title" />
          <ModalBody>
            {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
            {`"${deal.title}" and its history will be removed. This cannot be undone.`}
          </ModalBody>
          <ModalFooter>
            <Button variant="danger" onClick={onDelete} isLoading={action.busy} isDisabled={action.busy}>
              Delete
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
