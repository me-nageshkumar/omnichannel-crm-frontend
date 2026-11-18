import * as React from 'react';
import { Alert, AlertActionCloseButton, Button, Content, Flex, FlexItem } from '@patternfly/react-core';
import { type Order, getBillingSettings, getCustomerOptions, getWallet, quoteFor, raiseOrder } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { inr } from '@app/Billing/common/money';
import { TopUpDialog } from '@app/Billing/common/TopUpDialog';
import { WalletCard } from '@app/Billing/common/WalletCard';

type Dialog = { kind: 'topUp' };

/** A customer's wallet on its page, for platform staff: what it holds, and what staff may do with it. */
export const CustomerWalletCard: React.FunctionComponent<{
  customerId: string;
  /** Changes when something else on the page changed the customer's billing. */
  reloadKey?: number;
  onChanged?(): void;
}> = ({ customerId, reloadKey = 0, onChanged }) => {
  const canManage = useAccess().has('subscription:manage');
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
  const actions = (
    <Flex gap={{ default: 'gapSm' }}>
      {canManage && topUp?.allowed && (
        <FlexItem>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'topUp' })}>
            Top up
          </Button>
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
      </WalletCard>
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
