import * as React from 'react';
import {
  Alert,
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { PERIOD_LABEL, type Subscription, getMySubscription } from '@app/api/billing';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { IncludedGroups } from '@app/Billing/common/IncludedGroups';
import { LimitsTable } from '@app/Billing/common/LimitsTable';
import { stateText, termText } from '@app/Billing/common/planDates';
import { StateLabel } from '@app/Billing/common/StateLabel';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "12 days left" while the term runs; "" otherwise. */
function daysLeft(s: Subscription, now: number): string {
  if (s.state !== 'ACTIVE' || !s.termEnd) return '';
  const days = Math.ceil((new Date(s.termEnd).getTime() - now) / DAY_MS);
  return days <= 0 ? '' : `${days} ${days === 1 ? 'day' : 'days'} left`;
}

/** A customer's own plan: what it is on, until when, what it includes and how much of each limit is used. */
export const MyBillingPage: React.FunctionComponent = () => {
  const subscription = useLoad(getMySubscription);
  const s = subscription.data;
  return (
    <PageShell title="Plan & billing">
      {subscription.error && <Alert variant="danger" isInline title={subscription.error} />}
      {!s && !subscription.error && <Spinner aria-label="Loading plan" />}
      {s && !s.plan && (
        <EmptyState titleText="No plan yet" headingLevel="h2">
          <EmptyStateBody>Your account manager assigns the plan.</EmptyStateBody>
        </EmptyState>
      )}
      {s && s.plan && (
        <Stack hasGutter>
          <StackItem>
            <Card component="section" aria-label="Your plan">
              <CardTitle>Your plan</CardTitle>
              <CardBody>
                <DescriptionList isHorizontal isCompact>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Plan</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                        <FlexItem>{s.plan.name}</FlexItem>
                        <FlexItem>{PERIOD_LABEL[s.plan.period]}</FlexItem>
                        <FlexItem>
                          <StateLabel state={s.state} />
                        </FlexItem>
                      </Flex>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Term</DescriptionListTerm>
                    <DescriptionListDescription>
                      {termText(s)}
                      {daysLeft(s, Date.now()) && <div>{daysLeft(s, Date.now())}</div>}
                      {stateText(s) && <div>{stateText(s)}</div>}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </CardBody>
            </Card>
          </StackItem>
          <StackItem>
            <Card>
              <CardTitle>What is included</CardTitle>
              <CardBody>
                <DescriptionList isHorizontal isCompact>
                  <IncludedGroups groups={s.groups} />
                </DescriptionList>
              </CardBody>
            </Card>
          </StackItem>
          <StackItem>
            <Card>
              <CardTitle>Limits and usage</CardTitle>
              <CardBody>
                <LimitsTable limits={s.limits} />
              </CardBody>
            </Card>
          </StackItem>
        </Stack>
      )}
    </PageShell>
  );
};
