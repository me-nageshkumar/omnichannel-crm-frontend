import * as React from 'react';
import { getWallet } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { WalletCard } from '@app/Billing/common/WalletCard';

/** A customer's wallet on its page, for platform staff. */
export const CustomerWalletCard: React.FunctionComponent<{
  customerId: string;
  /** Changes when something else on the page changed the customer's billing. */
  reloadKey?: number;
  onChanged?(): void;
}> = ({ customerId, reloadKey = 0 }) => {
  const wallet = useLoad((t) => getWallet(t, customerId), [customerId], { keepOnError: true });
  const first = React.useRef(true);
  const reload = wallet.reload;
  React.useEffect(() => {
    if (first.current) first.current = false;
    else reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);
  return <WalletCard wallet={wallet.data} error={wallet.error} />;
};
