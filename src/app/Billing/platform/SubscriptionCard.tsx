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
  Spinner,
} from '@patternfly/react-core';
import {
  PERIOD_LABEL,
  type Subscription,
  customerSubscriptionEvents,
  deleteCustomerSubscription,
  getCustomerSubscription,
} from '@app/api/billing';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { IncludedGroups } from '@app/Billing/common/IncludedGroups';
import { LimitsTable } from '@app/Billing/common/LimitsTable';
import { stateText, termText } from '@app/Billing/common/planDates';
import { StateLabel } from '@app/Billing/common/StateLabel';
import { AssignPlanModal } from '@app/Billing/platform/AssignPlanModal';
import { BillingHistoryModal } from '@app/Billing/platform/BillingHistoryModal';

type Dialog = 'assign' | 'remove' | 'history';

/** A customer's plan on its page, for platform staff: what it is on, until when, and what it uses. */
export const SubscriptionCard: React.FunctionComponent<{ customerId: string; onChanged?(): void }> = ({
  customerId,
  onChanged,
}) => {
  const { token } = useSession();
  const canManage = useAccess().has('subscription:manage');
  const subscription = useLoad((t) => getCustomerSubscription(t, customerId), [customerId]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const remove = useAction();
  const s: Subscription | undefined = subscription.data;

  const onRemove = async () => {
    const done = await remove.run(async () => {
      await deleteCustomerSubscription(token as string, customerId);
      return true;
    });
    if (done) {
      setDialog(null);
      subscription.reload();
      onChanged?.();
    }
  };

  return (
    <Card component="section" aria-label="Subscription">
      <CardHeader
        actions={{
          actions: s ? (
            <Flex gap={{ default: 'gapSm' }}>
              {canManage && (
                <FlexItem>
                  <Button variant="secondary" onClick={() => setDialog('assign')}>
                    {s.plan ? 'Change plan' : 'Assign plan'}
                  </Button>
                </FlexItem>
              )}
              {canManage && s.plan && (
                <FlexItem>
                  <Button
                    variant="link"
                    isDanger
                    onClick={() => {
                      remove.reset();
                      setDialog('remove');
                    }}
                  >
                    Remove plan
                  </Button>
                </FlexItem>
              )}
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
              <IncludedGroups groups={s.groups} />
            </DescriptionList>
            {s.plan && <LimitsTable limits={s.limits} />}
          </>
        )}
      </CardBody>
      {dialog === 'assign' && s && (
        <AssignPlanModal
          customerId={customerId}
          current={s}
          onSaved={(saved) => {
            subscription.setData(() => saved);
            setDialog(null);
            onChanged?.();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'remove' && (
        <ConfirmModal
          title="Remove the plan?"
          confirmLabel="Remove"
          variant="danger"
          busy={remove.busy}
          error={remove.error}
          onConfirm={() => void onRemove()}
          onCancel={() => setDialog(null)}
        >
          The customer will be treated as any customer without a plan.
        </ConfirmModal>
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
