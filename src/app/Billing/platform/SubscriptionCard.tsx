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
import { PERIOD_LABEL, type Subscription, customerSubscriptionEvents, getCustomerSubscription } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { IncludedGroups } from '@app/Billing/common/IncludedGroups';
import { LimitsTable } from '@app/Billing/common/LimitsTable';
import { stateText, termText } from '@app/Billing/common/planDates';
import { StateLabel } from '@app/Billing/common/StateLabel';
import { BillingHistoryModal } from '@app/Billing/platform/BillingHistoryModal';

type Dialog = 'history';

/** A customer's plan on its page, for platform staff: what it is on, until when, and what it uses. */
export const SubscriptionCard: React.FunctionComponent<{ customerId: string; onChanged?(): void }> = ({
  customerId,
}) => {
  const subscription = useLoad((t) => getCustomerSubscription(t, customerId), [customerId]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const s: Subscription | undefined = subscription.data;

  return (
    <Card component="section" aria-label="Subscription">
      <CardHeader
        actions={{
          actions: s ? (
            <Flex gap={{ default: 'gapSm' }}>
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
