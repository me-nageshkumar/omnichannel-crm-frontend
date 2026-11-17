import * as React from 'react';
import { Alert, Content } from '@patternfly/react-core';
import { type BillingPeriod, PERIOD_UNIT, type PlanItem, type Price, pricePlan } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

const DELAY_MS = 300;

/**
 * A plan's price for one period. The figures always come from the server: while the person edits, it is asked again
 * shortly after the last change, and the previous figures stay, dimmed, until it answers.
 *
 * @param live false shows `saved` as it is and asks nothing (someone who may only look)
 */
export const PriceSummary: React.FunctionComponent<{
  items: PlanItem[];
  discountPercent: number;
  period: BillingPeriod;
  saved: Price | null;
  live: boolean;
}> = ({ items, discountPercent, period, saved, live }) => {
  const { token } = useSession();
  const [price, setPrice] = React.useState<Price | null>(saved);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = JSON.stringify({ items, discountPercent });

  React.useEffect(() => {
    if (!live) return undefined;
    let current = true;
    setPending(true);
    const timer = window.setTimeout(() => {
      pricePlan(token as string, JSON.parse(key))
        .then((p) => {
          if (!current) return;
          setPrice(p);
          setError(null);
        })
        .catch((e) => current && setError(messageFor(e)))
        .finally(() => current && setPending(false));
    }, DELAY_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [key, live, token]);

  return (
    <section aria-label="Price" style={{ opacity: pending ? 0.6 : 1 }}>
      {error && <Alert variant="danger" isInline isPlain title={`The price could not be worked out. ${error}`} />}
      {price && (
        <Content component="p">
          {`Actual ${formatMoney(price.actualPrice, 'INR')} · Discount ${formatMoney(price.discountAmount, 'INR')} · `}
          <strong>{`Price ${formatMoney(price.discountedPrice, 'INR')}`}</strong>
          {` per ${PERIOD_UNIT[period]}, before tax`}
        </Content>
      )}
    </section>
  );
};
