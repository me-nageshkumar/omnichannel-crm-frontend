import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
  Label,
  MenuToggle,
  Spinner,
} from '@patternfly/react-core';
import {
  type Order,
  PERIOD_LABEL,
  type Subscription,
  customerSubscriptionEvents,
  getCustomerSubscription,
} from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { formatMoney } from '@app/Crm/common/money';
import { useAccess } from '@app/session/useAccess';
import { billingDate } from '@app/Billing/common/billingDate';
import { IncludedGroups } from '@app/Billing/common/IncludedGroups';
import { LimitsTable } from '@app/Billing/common/LimitsTable';
import { stateText, termText } from '@app/Billing/common/planDates';
import { StateLabel } from '@app/Billing/common/StateLabel';
import { AdjustDialog } from '@app/Billing/platform/AdjustDialog';
import { BillingHistoryModal } from '@app/Billing/platform/BillingHistoryModal';
import { CancelDialog } from '@app/Billing/platform/CancelDialog';
import { OrderDialog, type StaffOrderKind } from '@app/Billing/platform/OrderDialog';
import { RefundDialog } from '@app/Billing/platform/RefundDialog';

type Dialog =
  | { kind: 'history' }
  | { kind: 'order'; order: StaffOrderKind }
  | { kind: 'cancel'; addOn: { id: string; label: string } | null }
  | { kind: 'adjust'; mode: 'termEnd' | 'credit' }
  | { kind: 'refund' };

/** A customer's plan on its page, for platform staff: what it is on, until when, and what it uses. */
export const SubscriptionCard: React.FunctionComponent<{
  customerId: string;
  /** Changes when something else on the page changed the customer's billing. */
  reloadKey?: number;
  onChanged?(): void;
}> = ({ customerId, reloadKey = 0, onChanged }) => {
  const canManage = useAccess().has('subscription:manage');
  const canRefund = useAccess().has('refund:manage');
  const [moreOpen, setMoreOpen] = React.useState(false);
  const subscription = useLoad((t) => getCustomerSubscription(t, customerId), [customerId, reloadKey], {
    keepOnError: true,
  });
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [raised, setRaised] = React.useState<Order | null>(null);
  const s: Subscription | undefined = subscription.data;
  /** Something changed the customer's billing: close the dialog and let the page load it again. */
  const done = () => {
    setDialog(null);
    if (onChanged) onChanged();
    else subscription.reload();
  };
  const addOnLabel = (a: Subscription['addOns'][number]) =>
    a.kind === 'GROUP'
      ? (s?.groups.filter((g) => g.code === a.groupCode)[0]?.name ?? a.groupCode ?? '')
      : `${a.quantity} extra ${s?.limits.filter((l) => l.key === a.limitKey)[0]?.label ?? a.limitKey}`;
  // what can be asked for depends on where the plan stands; the server has the last word
  const ended = !!s && (s.state === 'EXPIRED' || s.cancelled);
  const actions: { kind: StaffOrderKind; label: string }[] =
    !s || !canManage
      ? []
      : [
          ...(!s.plan || ended ? [{ kind: 'NEW' as const, label: 'New plan' }] : []),
          ...(s.plan && !ended ? [{ kind: 'CHANGE' as const, label: 'Change plan' }] : []),
          ...(s.plan && !s.cancelled && !s.next ? [{ kind: 'RENEWAL' as const, label: 'Renew' }] : []),
          ...(s.plan && s.state === 'ACTIVE' ? [{ kind: 'ADDON' as const, label: 'Add add-on' }] : []),
        ];

  // what moves money needs the right to refund; moving a date needs only the right to manage subscriptions
  const running = !!s && !!s.plan && !ended;
  const more: { label: string; dialog: Dialog }[] = !s
    ? []
    : [
        ...(canManage && running
          ? [{ label: 'Extend term', dialog: { kind: 'adjust' as const, mode: 'termEnd' as const } }]
          : []),
        ...(canRefund && running
          ? s.addOns.map((a) => ({
              label: `Cancel add-on: ${addOnLabel(a)}`,
              dialog: { kind: 'cancel' as const, addOn: { id: a.id, label: addOnLabel(a) } },
            }))
          : []),
        ...(canRefund && running ? [{ label: 'Cancel plan', dialog: { kind: 'cancel' as const, addOn: null } }] : []),
        ...(canRefund && s.plan
          ? [{ label: 'Post account credit', dialog: { kind: 'adjust' as const, mode: 'credit' as const } }]
          : []),
        ...(canRefund && s.creditBalance > 0 ? [{ label: 'Record refund', dialog: { kind: 'refund' as const } }] : []),
      ];

  return (
    <Card component="section" aria-label="Subscription">
      <CardHeader
        actions={{
          actions: s ? (
            <Flex gap={{ default: 'gapSm' }}>
              {actions.map((a) => (
                <FlexItem key={a.kind}>
                  <Button variant="secondary" onClick={() => setDialog({ kind: 'order', order: a.kind })}>
                    {a.label}
                  </Button>
                </FlexItem>
              ))}
              {more.length > 0 && (
                <FlexItem>
                  <Dropdown
                    isOpen={moreOpen}
                    onOpenChange={setMoreOpen}
                    popperProps={{ position: 'right' }}
                    toggle={(ref) => (
                      <MenuToggle ref={ref} isExpanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
                        More
                      </MenuToggle>
                    )}
                  >
                    <DropdownList>
                      {more.map((m) => (
                        <DropdownItem
                          key={m.label}
                          onClick={() => {
                            setMoreOpen(false);
                            setDialog(m.dialog);
                          }}
                        >
                          {m.label}
                        </DropdownItem>
                      ))}
                    </DropdownList>
                  </Dropdown>
                </FlexItem>
              )}
              <FlexItem>
                <Button variant="link" onClick={() => setDialog({ kind: 'history' })}>
                  History
                </Button>
              </FlexItem>
            </Flex>
          ) : undefined,
        }}
      >
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardBody>
        {subscription.error && <Alert variant="danger" isInline title={subscription.error} />}
        {raised && (
          <Alert
            variant="success"
            isInline
            title={`Order ${raised.number} was raised. It takes effect when its payment is recorded.`}
          />
        )}
        {!s && !subscription.error && <Spinner aria-label="Loading subscription" />}
        {s && (
          <>
            <DescriptionList isHorizontal isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>Plan</DescriptionListTerm>
                <DescriptionListDescription>
                  <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                    {s.plan && <FlexItem>{s.plan.name}</FlexItem>}
                    {s.plan && <FlexItem>{PERIOD_LABEL[s.plan.period]}</FlexItem>}
                    <FlexItem>
                      <StateLabel state={s.state} />
                    </FlexItem>
                    {s.cancelled && (
                      <FlexItem>
                        <Label color="red" isCompact>
                          Cancelled
                        </Label>
                      </FlexItem>
                    )}
                  </Flex>
                </DescriptionListDescription>
              </DescriptionListGroup>
              {s.plan && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Term</DescriptionListTerm>
                  <DescriptionListDescription>
                    {termText(s)}
                    {stateText(s) && <div>{stateText(s)}</div>}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {s.next && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Renewed</DescriptionListTerm>
                  <DescriptionListDescription>
                    {s.next.planName}, from {billingDate(s.next.termStart, s.zone)} to{' '}
                    {billingDate(s.next.termEnd, s.zone, 1)}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {s.creditBalance > 0 && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Account credit</DescriptionListTerm>
                  <DescriptionListDescription>{formatMoney(s.creditBalance, 'INR')}</DescriptionListDescription>
                </DescriptionListGroup>
              )}
              <IncludedGroups groups={s.groups} />
            </DescriptionList>
            {s.plan && <LimitsTable limits={s.limits} />}
          </>
        )}
      </CardBody>
      {dialog?.kind === 'order' && s && (
        <OrderDialog
          customerId={customerId}
          subscription={s}
          kind={dialog.order}
          onRaised={(order) => {
            setRaised(order);
            done();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'cancel' && s && (
        <CancelDialog
          customerId={customerId}
          zone={s.zone}
          addOn={dialog.addOn}
          onDone={done}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'adjust' && s && (
        <AdjustDialog
          customerId={customerId}
          subscription={s}
          mode={dialog.mode}
          onDone={done}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'refund' && s && (
        <RefundDialog
          customerId={customerId}
          creditBalance={s.creditBalance}
          onDone={done}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'history' && (
        <BillingHistoryModal
          title="Subscription history"
          load={(t) => customerSubscriptionEvents(t, customerId)}
          onClose={() => setDialog(null)}
        />
      )}
    </Card>
  );
};
