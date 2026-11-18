import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  Label,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import {
  type Order,
  PERIOD_LABEL,
  type Subscription,
  getMyOptions,
  getMySubscription,
  getMyWallet,
  listMyOrders,
  myQuote,
  raiseMyOrder,
} from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { useAccess } from '@app/session/useAccess';
import { billingDate } from '@app/Billing/common/billingDate';
import { MyDocuments } from '@app/Billing/my/MyDocuments';
import { type AddOnOffer, MyOrderDialog, type MyOrderKind } from '@app/Billing/my/MyOrderDialog';
import { MyProfileCard } from '@app/Billing/my/MyProfileCard';
import { MyRequests } from '@app/Billing/my/MyRequests';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { Table, Tbody, Td, Tr } from '@patternfly/react-table';
import { IncludedGroups } from '@app/Billing/common/IncludedGroups';
import { LimitsTable } from '@app/Billing/common/LimitsTable';
import { stateText, termText } from '@app/Billing/common/planDates';
import { StateLabel } from '@app/Billing/common/StateLabel';
import { TopUpDialog } from '@app/Billing/common/TopUpDialog';
import { WalletCard } from '@app/Billing/common/WalletCard';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "12 days left" while the term runs; "" otherwise. */
function daysLeft(s: Subscription, now: number): string {
  if (s.state !== 'ACTIVE' || !s.termEnd) return '';
  const days = Math.ceil((new Date(s.termEnd).getTime() - now) / DAY_MS);
  return days <= 0 ? '' : `${days} ${days === 1 ? 'day' : 'days'} left`;
}

/**
 * A customer's own plan and billing: what it is on and until when, what it can ask for (a renewal, a higher plan,
 * add-ons), its requests and how to pay them, its invoices and credit, and its billing details.
 */
export const MyBillingPage: React.FunctionComponent = () => {
  const canRequest = useAccess().has('billing:request');
  const [tick, setTick] = React.useState(0);
  const subscription = useLoad(getMySubscription, [], { keepOnError: true });
  const options = useLoad(getMyOptions, [], { keepOnError: true });
  const orders = useLoad(listMyOrders, [], { keepOnError: true });
  const wallet = useLoad(getMyWallet, [], { keepOnError: true });
  const [dialog, setDialog] = React.useState<{ kind: MyOrderKind; offer?: AddOnOffer } | null>(null);
  const [sent, setSent] = React.useState<Order | null>(null);
  const [toppingUp, setToppingUp] = React.useState(false);
  const s = subscription.data;
  const o = options.data;
  // each list is asked again in place: the page stays as it is while the answers come
  const changed = () => {
    subscription.reload();
    options.reload();
    orders.reload();
    wallet.reload();
    setTick((n) => n + 1);
  };
  const waiting = (orders.data ?? []).some((x) => x.status === 'REQUESTED');
  // once the plan has run out, renewing is what is left; the rest comes back with the plan
  const running = !!s && s.state !== 'EXPIRED' && !s.cancelled;
  const zone = s?.zone ?? 'Asia/Kolkata';
  const offerPrice = (a: AddOnOffer) =>
    a.kind === 'GROUP'
      ? `${formatMoney(a.unitPrice, 'INR')} for a full term`
      : `${formatMoney(a.unitPrice, 'INR')} per ${a.unit} for a full term`;

  return (
    <PageShell title="Plan & billing">
      {subscription.error && <Alert variant="danger" isInline title={subscription.error} />}
      {!s && !subscription.error && <Spinner aria-label="Loading plan" />}
      {options.error && (
        <Alert variant="warning" isInline title={`What you can ask for could not be loaded. ${options.error}`} />
      )}
      {s && (
        <Stack hasGutter>
          {sent && (
            <StackItem>
              <Alert
                variant="success"
                isInline
                title={`Request ${sent.number} was sent. It takes effect when your payment is recorded.`}
              />
            </StackItem>
          )}
          {!s.plan && (
            <StackItem>
              <EmptyState titleText="No plan yet" headingLevel="h2">
                <EmptyStateBody>Your account manager sets up your first plan.</EmptyStateBody>
              </EmptyState>
            </StackItem>
          )}
          {s.plan && (
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
                    <DescriptionListGroup>
                      <DescriptionListTerm>Term</DescriptionListTerm>
                      <DescriptionListDescription>
                        {termText(s)}
                        {daysLeft(s, Date.now()) && <div>{daysLeft(s, Date.now())}</div>}
                        {stateText(s) && <div>{stateText(s)}</div>}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
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
                        <DescriptionListDescription>
                          {formatMoney(s.creditBalance, 'INR')}
                          <div>
                            <small>It is set against your next request.</small>
                          </div>
                        </DescriptionListDescription>
                      </DescriptionListGroup>
                    )}
                  </DescriptionList>
                  {s.cancelled && (
                    <Alert
                      variant="warning"
                      isInline
                      isPlain
                      className="pf-v6-u-mt-md"
                      title="Your plan was cancelled. Ask your account manager for a new plan."
                    />
                  )}
                  {canRequest && o && (
                    <Flex
                      gap={{ default: 'gapSm' }}
                      alignItems={{ default: 'alignItemsCenter' }}
                      className="pf-v6-u-mt-md"
                    >
                      {!s.cancelled && !s.next && (
                        <FlexItem>
                          <Button
                            variant="primary"
                            isDisabled={!o.renewal.allowed}
                            aria-describedby={o.renewal.allowed ? undefined : 'renewal-reason'}
                            onClick={() => setDialog({ kind: 'RENEWAL' })}
                          >
                            Renew
                          </Button>
                        </FlexItem>
                      )}
                      {running && o.upgrades.length > 0 && (
                        <FlexItem>
                          <Button variant="secondary" onClick={() => setDialog({ kind: 'UPGRADE' })}>
                            Upgrade
                          </Button>
                        </FlexItem>
                      )}
                      {!s.cancelled && !s.next && !o.renewal.allowed && o.renewal.reason && (
                        <FlexItem>
                          <HelperText>
                            <HelperTextItem id="renewal-reason">{o.renewal.reason}</HelperTextItem>
                          </HelperText>
                        </FlexItem>
                      )}
                    </Flex>
                  )}
                </CardBody>
              </Card>
            </StackItem>
          )}
          {s.plan && (
            <StackItem>
              <WalletCard
                wallet={wallet.data}
                error={wallet.error}
                actions={
                  canRequest && o?.topUp.allowed ? (
                    <Button variant="secondary" onClick={() => setToppingUp(true)}>
                      Top up
                    </Button>
                  ) : undefined
                }
              >
                {/* a plan that charges nothing says so above; any other reason is the server's */}
                {wallet.data && wallet.data.messageRate !== null && o && !o.topUp.allowed && o.topUp.reason && (
                  <Content component="small">{o.topUp.reason}</Content>
                )}
              </WalletCard>
            </StackItem>
          )}
          {running && o && o.addOns.length > 0 && (
            <StackItem>
              <Card component="section" aria-label="Add-ons you can buy">
                <CardTitle>Add-ons you can buy</CardTitle>
                <CardBody>
                  <Table variant="compact" borders={false} aria-label="Add-ons you can buy">
                    <Tbody>
                      {o.addOns.map((a) => (
                        <Tr key={`${a.kind}:${a.groupCode ?? a.limitKey}`}>
                          <Td>{a.name}</Td>
                          <Td>{offerPrice(a)}</Td>
                          <Td modifier="fitContent">
                            {canRequest && (
                              <Button variant="secondary" onClick={() => setDialog({ kind: 'ADDON', offer: a })}>
                                Buy
                              </Button>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </StackItem>
          )}
          <StackItem>
            {orders.error && <Alert variant="danger" isInline title={orders.error} />}
            {orders.data && (
              <MyRequests
                orders={orders.data}
                zone={zone}
                paymentInstructions={o?.paymentInstructions ?? null}
                canRequest={canRequest}
                onChanged={changed}
              />
            )}
          </StackItem>
          <StackItem>
            <MyDocuments zone={zone} reloadKey={tick} />
          </StackItem>
          <StackItem>
            <MyProfileCard canEdit={canRequest} locked={waiting} />
          </StackItem>
          {s.plan && (
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
          )}
          {s.plan && (
            <StackItem>
              <Card>
                <CardTitle>Limits and usage</CardTitle>
                <CardBody>
                  <LimitsTable limits={s.limits} />
                </CardBody>
              </Card>
            </StackItem>
          )}
        </Stack>
      )}
      {dialog && s && o && (
        <MyOrderDialog
          kind={dialog.kind}
          subscription={s}
          options={o}
          offer={dialog.offer}
          onRaised={(order) => {
            setSent(order);
            setDialog(null);
            changed();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {toppingUp && s && o && (
        <TopUpDialog
          zone={zone}
          min={o.topUp.min}
          max={o.topUp.max}
          fetchQuote={myQuote}
          raise={raiseMyOrder}
          sendLabel="Send request"
          note="Your request takes effect when your payment is recorded. How to pay is shown beside the request."
          onRaised={(order) => {
            setSent(order);
            setToppingUp(false);
            changed();
          }}
          onCancel={() => setToppingUp(false)}
        />
      )}
    </PageShell>
  );
};
