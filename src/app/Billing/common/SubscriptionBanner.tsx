import * as React from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '@patternfly/react-core';
import type { SubscriptionSummary } from '@app/api/billing';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { billingDate } from '@app/Billing/common/billingDate';

/** What to tell the customer's users about its plan now; null when there is nothing to say. */
export function noticeFor(
  s: SubscriptionSummary | null | undefined,
): { text: string; status: 'warning' | 'danger' } | null {
  if (!s) return null;
  if (s.state === 'GRACE' && s.termEnd && s.graceEnd) {
    return {
      status: 'warning',
      text: `Your plan ended on ${billingDate(s.termEnd, s.zone, 1)}. Renew by ${billingDate(s.graceEnd, s.zone, 1)} to keep working.`,
    };
  }
  if (s.state === 'EXPIRED') {
    return { status: 'danger', text: 'Your plan has ended. The account is read-only until it is renewed.' };
  }
  if (s.readOnly) return { status: 'danger', text: 'The account has no plan and is read-only.' };
  return null;
}

/**
 * Across the top of every page for a customer in grace or read-only, and under it for one whose wallet is running
 * low. Platform staff never see either.
 */
export const SubscriptionBanner: React.FunctionComponent = () => {
  const { user } = useSession();
  const canSeeBilling = useAccess().has('billing:view');
  const notice = noticeFor(user?.subscription);
  const lowWallet = !!user?.subscription?.lowWallet;
  if (!notice && !lowWallet) return null;
  return (
    <>
      {notice && (
        <section aria-label="Plan notice">
          <Banner status={notice.status} screenReaderText={notice.status === 'danger' ? 'Important' : 'Warning'}>
            {notice.text} {canSeeBilling ? <Link to="/billing">Plan &amp; billing</Link> : 'Ask your administrator.'}
          </Banner>
        </section>
      )}
      {lowWallet && (
        <section aria-label="Wallet notice">
          <Banner status="warning" screenReaderText="Warning">
            Your wallet balance is low. Messages stop sending when it runs out.{' '}
            {canSeeBilling ? <Link to="/billing">Top up</Link> : 'Ask your administrator.'}
          </Banner>
        </section>
      )}
    </>
  );
};
