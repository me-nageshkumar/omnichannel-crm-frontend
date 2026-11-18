import * as React from 'react';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Spinner,
} from '@patternfly/react-core';
import type { Wallet } from '@app/api/billing';
import { inr4 } from '@app/Billing/common/money';

/**
 * A customer's wallet: what it holds, what a message costs, and whether it is running low. Every figure is the
 * server's. `actions` go in the header; `children` under the figures (a note, a result line).
 */
export const WalletCard: React.FunctionComponent<{
  wallet: Wallet | undefined;
  error?: string | null;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ wallet, error, actions, children }) => (
  <Card component="section" aria-label="Wallet">
    <CardHeader actions={actions && wallet ? { actions } : undefined}>
      <CardTitle>Wallet</CardTitle>
    </CardHeader>
    <CardBody>
      {error && <Alert variant="danger" isInline title={error} />}
      {!wallet && !error && <Spinner aria-label="Loading wallet" />}
      {wallet && (
        <>
          <DescriptionList isHorizontal isCompact>
            <DescriptionListGroup>
              <DescriptionListTerm>Balance</DescriptionListTerm>
              <DescriptionListDescription>{inr4(wallet.balance)}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Message rate</DescriptionListTerm>
              <DescriptionListDescription>
                {wallet.messageRate === null
                  ? 'Messages are not charged on this plan.'
                  : `${inr4(wallet.messageRate)} per message`}
              </DescriptionListDescription>
            </DescriptionListGroup>
            {wallet.lowBalanceAt !== null && (
              <DescriptionListGroup>
                <DescriptionListTerm>Warning level</DescriptionListTerm>
                <DescriptionListDescription>{inr4(wallet.lowBalanceAt)}</DescriptionListDescription>
              </DescriptionListGroup>
            )}
          </DescriptionList>
          {wallet.low && (
            <Alert
              variant="warning"
              isInline
              isPlain
              className="pf-v6-u-mt-md"
              title="The balance is below the warning level."
            />
          )}
          {children}
        </>
      )}
    </CardBody>
  </Card>
);
