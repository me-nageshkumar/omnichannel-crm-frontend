import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import {
  type BillingOptions,
  type Order,
  PERIOD_LABEL,
  type QuoteRequest,
  type Subscription,
  myQuote,
  raiseMyOrder,
} from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { formatMoney } from '@app/Crm/common/money';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { QuotePanel } from '@app/Billing/common/QuotePanel';
import { useQuote } from '@app/Billing/common/useQuote';

export type MyOrderKind = 'RENEWAL' | 'UPGRADE' | 'ADDON';
export type AddOnOffer = BillingOptions['addOns'][number];

const TITLE: Record<MyOrderKind, string> = {
  RENEWAL: 'Renew your plan',
  UPGRADE: 'Upgrade your plan',
  ADDON: 'Buy an add-on',
};
const SHOWN: Record<MyOrderKind, string[]> = { RENEWAL: [], UPGRADE: ['planCode'], ADDON: ['addOn'] };

/** What a customer reads when billing is not set up: its own details are the part it can put right. */
const problemText = (e: unknown) =>
  e instanceof ApiError && e.code === 'BILLING_NOT_SET_UP'
    ? (e.extra?.missing ?? '').indexOf('supplier') >= 0
      ? 'Requests cannot be taken yet. Please ask your account manager.'
      : 'Fill in your billing details on this page before sending a request.'
    : messageFor(e);

/**
 * A customer's own request: to renew, to move to a higher plan, or to buy an add-on. The price is the server's
 * answer for what the form says, and the request sent is that same one. It takes effect when the payment is
 * recorded.
 */
export const MyOrderDialog: React.FunctionComponent<{
  kind: MyOrderKind;
  subscription: Subscription;
  options: BillingOptions;
  /** ADDON: the add-on being bought. */
  offer?: AddOnOffer;
  onRaised(order: Order): void;
  onCancel(): void;
}> = ({ kind, subscription, options, offer, onRaised, onCancel }) => {
  const { token } = useSession();
  const [planCode, setPlanCode] = React.useState(options.upgrades.length === 1 ? options.upgrades[0].code : '');
  const [keep, setKeep] = React.useState<string[]>(() => subscription.addOns.map((a) => a.id));
  const [quantity, setQuantity] = React.useState('');
  const raise = useAction(SHOWN[kind]);

  let request: QuoteRequest | null = null;
  if (kind === 'RENEWAL') {
    request = { kind, keepAddOnIds: subscription.addOns.filter((a) => keep.indexOf(a.id) >= 0).map((a) => a.id) };
  } else if (kind === 'UPGRADE') {
    request = planCode ? { kind, planCode } : null;
  } else if (offer && offer.kind === 'GROUP' && offer.groupCode) {
    request = { kind, addOn: { kind: 'GROUP', groupCode: offer.groupCode } };
  } else if (offer && offer.kind === 'LIMIT' && offer.limitKey && Number(quantity) > 0) {
    request = { kind, addOn: { kind: 'LIMIT', limitKey: offer.limitKey, quantity: Number(quantity) } };
  }

  const priced = useQuote(request, myQuote);
  const refused =
    priced.problem instanceof ApiError && priced.problem.code === 'VALIDATION' ? (priced.problem.fields ?? {}) : {};
  const fieldErrors: Record<string, string> = { ...refused, ...raise.fieldErrors };
  const unshown = Object.keys(refused)
    .filter((f) => SHOWN[kind].indexOf(f) < 0)
    .map((f) => refused[f]);
  const quoteError =
    priced.problem === null
      ? null
      : unshown.length > 0
        ? unshown.join('; ')
        : Object.keys(refused).length > 0
          ? null
          : problemText(priced.problem);

  const send = async () => {
    if (!request || !priced.matches) return;
    const body = request;
    const order = await raise.run(() => raiseMyOrder(token as string, body), problemText);
    if (order) onRaised(order);
  };
  const problem = (field: string, hint?: string) =>
    fieldErrors[field] || hint ? (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={fieldErrors[field] ? 'error' : 'default'}>
            {fieldErrors[field] ?? hint}
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    ) : null;
  const heldLabel = (a: Subscription['addOns'][number]) =>
    a.kind === 'GROUP'
      ? (subscription.groups.filter((g) => g.code === a.groupCode)[0]?.name ?? a.groupCode)
      : `${a.quantity} extra ${subscription.limits.filter((l) => l.key === a.limitKey)[0]?.label ?? a.limitKey}`;

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="my-order-title">
      <ModalHeader title={kind === 'ADDON' && offer ? `Buy ${offer.name}` : TITLE[kind]} labelId="my-order-title" />
      <ModalBody>
        <Form
          id="my-order-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {raise.error && <Alert variant="danger" isInline title={raise.error} />}
          {kind === 'UPGRADE' && (
            <FormGroup label="Plan" isRequired fieldId="my-order-plan">
              <FormSelect id="my-order-plan" value={planCode} onChange={(_e, v) => setPlanCode(v)}>
                <FormSelectOption value="" label="Choose a plan" isPlaceholder />
                {options.upgrades.map((p) => (
                  <FormSelectOption
                    key={p.code}
                    value={p.code}
                    label={`${p.name} · ${PERIOD_LABEL[p.period]} · ${formatMoney(p.discountedPrice, 'INR')}`}
                  />
                ))}
              </FormSelect>
              {problem(
                'planCode',
                'The new plan starts today. The unused days of your present plan come back as credit.',
              )}
            </FormGroup>
          )}
          {kind === 'RENEWAL' && subscription.addOns.length > 0 && (
            <FormGroup role="group" label="Add-ons to keep" fieldId="my-order-keep">
              {subscription.addOns.map((a) => (
                <Checkbox
                  key={a.id}
                  id={`my-order-keep-${a.id}`}
                  label={heldLabel(a)}
                  isChecked={keep.indexOf(a.id) >= 0}
                  onChange={(_e, on) => setKeep((list) => (on ? [...list, a.id] : list.filter((id) => id !== a.id)))}
                />
              ))}
            </FormGroup>
          )}
          {kind === 'ADDON' && offer && offer.kind === 'LIMIT' && (
            <FormGroup label="How many more" isRequired fieldId="my-order-quantity">
              <TextInput id="my-order-quantity" type="number" value={quantity} onChange={(_e, v) => setQuantity(v)} />
              {problem('addOn', `Sold in steps of ${offer.unit}; charged for the days left in your term`)}
            </FormGroup>
          )}
          {kind === 'ADDON' &&
            offer &&
            offer.kind === 'GROUP' &&
            problem('addOn', 'Charged for the days left in your term')}
          <QuotePanel quote={priced.quote} pending={priced.pending} error={quoteError} zone={subscription.zone} />
          <Alert
            variant="info"
            isInline
            isPlain
            title="Your request takes effect when your payment is recorded. How to pay is shown beside the request."
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="my-order-form"
          isDisabled={!priced.matches || raise.busy}
          isLoading={raise.busy}
        >
          Send request
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
