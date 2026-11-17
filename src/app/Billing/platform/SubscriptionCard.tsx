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
  Flex,
  FlexItem,
  Label,
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
import { BillingHistoryModal } from '@app/Billing/platform/BillingHistoryModal';
import { OrderDialog, type StaffOrderKind } from '@app/Billing/platform/OrderDialog';

type Dialog = 'history' | StaffOrderKind;

/** A customer's plan on its page, for platform staff: what it is on, until when, and what it uses. */
export const SubscriptionCard: React.FunctionComponent<{ customerId: string; onChanged?(): void }> = ({
  customerId,
  onChanged,
}) => {
  const canManage = useAccess().has('subscription:manage');
  const subscription = useLoad((t) => getCustomerSubscription(t, customerId), [customerId]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [raised, setRaised] = React.useState<Order | null>(null);
  const s: Subscription | undefined = subscription.data;
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

  return (
    <Card component="section" aria-label="Subscription">
      <CardHeader
        actions={{
          actions: s ? (
            <Flex gap={{ default: 'gapSm' }}>
              {actions.map((a) => (
                <FlexItem key={a.kind}>
                  <Button variant="secondary" onClick={() => setDialog(a.kind)}>
                    {a.label}
                  </Button>
                </FlexItem>
              ))}
              <FlexItem>
                <Button variant="link" onClick={() => setDialog('history')}>
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
      {dialog && dialog !== 'history' && s && (
        <OrderDialog
          customerId={customerId}
          subscription={s}
          kind={dialog}
          onRaised={(order) => {
            setRaised(order);
            setDialog(null);
            subscription.reload();
            onChanged?.();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'history' && (
        <BillingHistoryModal
          title="Subscription history"
          load={(t) => customerSubscriptionEvents(t, customerId)}
          onClose={() => setDialog(null)}
        />
      )}
    </Card>
  );
};
