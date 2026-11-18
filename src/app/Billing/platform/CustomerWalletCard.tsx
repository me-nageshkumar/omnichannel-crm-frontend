import * as React from 'react';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  Content,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
  MenuToggle,
} from '@patternfly/react-core';
import { type Order, getBillingSettings, getCustomerOptions, getWallet, quoteFor, raiseOrder } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { inr } from '@app/Billing/common/money';
import { TopUpDialog } from '@app/Billing/common/TopUpDialog';
import { WalletCard } from '@app/Billing/common/WalletCard';
import { WalletAdjustDialog } from '@app/Billing/platform/WalletAdjustDialog';
import { WalletRefundDialog } from '@app/Billing/platform/WalletRefundDialog';
import { WalletThresholdDialog } from '@app/Billing/platform/WalletThresholdDialog';

type Dialog = { kind: 'topUp' } | { kind: 'adjust' } | { kind: 'threshold' } | { kind: 'refund' };

/** A customer's wallet on its page, for platform staff: what it holds, and what staff may do with it. */
export const CustomerWalletCard: React.FunctionComponent<{
  customerId: string;
  /** Changes when something else on the page changed the customer's billing. */
  reloadKey?: number;
  onChanged?(): void;
}> = ({ customerId, reloadKey = 0, onChanged }) => {
  const canManage = useAccess().has('subscription:manage');
  const canRefund = useAccess().has('refund:manage');
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [refunded, setRefunded] = React.useState<Order | null>(null);
  const wallet = useLoad((t) => getWallet(t, customerId), [customerId], { keepOnError: true });
  const options = useLoad((t) => getCustomerOptions(t, customerId), [customerId], { keepOnError: true });
  const settings = useLoad(getBillingSettings);
  const zone = settings.data?.zone ?? 'Asia/Kolkata';
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [raised, setRaised] = React.useState<Order | null>(null);
  const first = React.useRef(true);
  const reloadWallet = wallet.reload;
  const reloadOptions = options.reload;
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reloadWallet();
    reloadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  /** Something changed the customer's billing: close the dialog and let the page load it again. */
  const done = () => {
    setDialog(null);
    if (onChanged) onChanged();
    else {
      reloadWallet();
      reloadOptions();
    }
  };
  const w = wallet.data;
  const topUp = options.data?.topUp;
  // an adjustment needs the right to manage subscriptions; taking paid money back out needs the right to refund
  const more: { label: string; dialog: Dialog }[] = [
    ...(canManage ? [{ label: 'Adjust wallet', dialog: { kind: 'adjust' as const } }] : []),
    ...(canManage ? [{ label: 'Low-balance warning', dialog: { kind: 'threshold' as const } }] : []),
    ...(canRefund ? [{ label: 'Refund wallet', dialog: { kind: 'refund' as const } }] : []),
  ];
  const actions = (
    <Flex gap={{ default: 'gapSm' }}>
      {canManage && topUp?.allowed && (
        <FlexItem>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'topUp' })}>
            Top up
          </Button>
        </FlexItem>
      )}
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
    </Flex>
  );

  return (
    <>
      <WalletCard wallet={w} error={wallet.error} actions={actions}>
        {/* a plan that charges nothing says so above; any other reason is the server's */}
        {w && w.messageRate !== null && topUp && !topUp.allowed && topUp.reason && (
          <Content component="small">{topUp.reason}</Content>
        )}
        {raised && (
          <Alert
            variant="success"
            isInline
            className="pf-v6-u-mt-md"
            title={`Order ${raised.number} was raised for ${inr(raised.payable)}. The wallet is topped up when its payment is recorded.`}
            actionClose={<AlertActionCloseButton onClose={() => setRaised(null)} />}
          />
        )}
        {refunded && (
          <Alert
            variant="success"
            isInline
            className="pf-v6-u-mt-md"
            title={`${inr(refunded.creditFromNotes)} was added to the account credit (${refunded.number}). Pay it out with Record refund.`}
            actionClose={<AlertActionCloseButton onClose={() => setRefunded(null)} />}
          />
        )}
      </WalletCard>
      {dialog?.kind === 'adjust' && w && (
        <WalletAdjustDialog
          customerId={customerId}
          balance={w.balance}
          onDone={done}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'threshold' && w && (
        <WalletThresholdDialog
          customerId={customerId}
          current={w.lowBalanceAt}
          onDone={done}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'refund' && w && (
        <WalletRefundDialog
          customerId={customerId}
          refundable={w.refundable}
          zone={zone}
          onDone={(order) => {
            setRefunded(order);
            done();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'topUp' && topUp && (
        <TopUpDialog
          zone={zone}
          min={topUp.min}
          max={topUp.max}
          fetchQuote={(t, request) => quoteFor(t, customerId, request)}
          raise={(t, request) => raiseOrder(t, customerId, request)}
          sendLabel="Raise order"
          onRaised={(order) => {
            setRaised(order);
            done();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </>
  );
};
