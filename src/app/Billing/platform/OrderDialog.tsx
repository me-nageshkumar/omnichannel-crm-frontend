import * as React from 'react';
import { Link } from 'react-router-dom';
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
  type Order,
  PERIOD_LABEL,
  type Plan,
  type QuoteRequest,
  type Subscription,
  type SubscriptionAddOnInput,
  getCustomerOptions,
  listGroups,
  listLimitKeys,
  listPlans,
  quoteFor,
  raiseOrder,
} from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { formatMoney } from '@app/Crm/common/money';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { todayIn } from '@app/Billing/common/billingDate';
import { QuotePanel } from '@app/Billing/common/QuotePanel';
import { useQuote } from '@app/Billing/common/useQuote';

export type StaffOrderKind = 'NEW' | 'CHANGE' | 'RENEWAL' | 'ADDON';

const TITLE: Record<StaffOrderKind, string> = {
  NEW: 'New plan',
  CHANGE: 'Change plan',
  RENEWAL: 'Renew',
  ADDON: 'Add an add-on',
};

const SHOWN: Record<StaffOrderKind, string[]> = {
  NEW: ['planCode', 'startDate', 'addOns', 'extraDiscountPercent', 'extraDiscountReason'],
  CHANGE: ['planCode', 'addOns', 'extraDiscountPercent', 'extraDiscountReason'],
  RENEWAL: ['extraDiscountPercent', 'extraDiscountReason'],
  ADDON: ['addOn', 'extraDiscountPercent', 'extraDiscountReason'],
};

const raiseProblem = (e: unknown) =>
  e instanceof ApiError && e.code === 'ORDER_PENDING'
    ? 'This customer already has an open request that changes its plan.'
    : messageFor(e);

/** Where to go when billing is not set up: the settings for the supplier, this page for the customer's profile. */
const SetUpHint: React.FunctionComponent<{ problem: unknown; canSettings: boolean }> = ({ problem, canSettings }) => {
  if (!(problem instanceof ApiError) || problem.code !== 'BILLING_NOT_SET_UP') return null;
  if ((problem.extra?.missing ?? '').indexOf('supplier') < 0) {
    return <p>Fill in the billing profile on this page, then come back.</p>;
  }
  return canSettings ? (
    <p>
      <Link to="/platform/billing-settings">Open billing settings</Link> and fill in the supplier details.
    </p>
  ) : (
    <p>Ask someone who manages the billing settings to fill in the supplier details.</p>
  );
};

/**
 * Raises an order for a customer: a new plan, a change of plan, a renewal or an add-on. The price shown is the
 * server's answer for what the form says, and the order raised is that same request.
 */
export const OrderDialog: React.FunctionComponent<{
  customerId: string;
  subscription: Subscription;
  kind: StaffOrderKind;
  onRaised(order: Order): void;
  onCancel(): void;
}> = ({ customerId, subscription, kind, onRaised, onCancel }) => {
  const { token } = useSession();
  const plans = useLoad((t) => listPlans(t));
  const groups = useLoad(listGroups);
  const limitKeys = useLoad(listLimitKeys);
  // an add-on is sold on the terms the customer's term was sold under: the server lists them
  const offers = useLoad(
    (t) => (kind === 'ADDON' ? getCustomerOptions(t, customerId) : Promise.resolve(null)),
    [customerId, kind],
  );
  const canSettings = useAccess().has('billing-settings:manage');
  const [planCode, setPlanCode] = React.useState('');
  const [startDate, setStartDate] = React.useState(() => todayIn(subscription.zone));
  const [groupAddOns, setGroupAddOns] = React.useState<string[]>(() =>
    kind === 'CHANGE'
      ? subscription.addOns.filter((a) => a.kind === 'GROUP' && a.groupCode).map((a) => a.groupCode as string)
      : [],
  );
  const [extra, setExtra] = React.useState<Record<string, string>>(() => {
    const held: Record<string, string> = {};
    if (kind === 'CHANGE') {
      subscription.addOns.forEach((a) => {
        // the same extra units bought twice are two add-ons: together they are what the customer holds
        if (a.kind === 'LIMIT' && a.limitKey) {
          held[a.limitKey] = String(Number(held[a.limitKey] ?? 0) + (a.quantity ?? 0));
        }
      });
    }
    return held;
  });
  const [keep, setKeep] = React.useState<string[]>(() => subscription.addOns.map((a) => a.id));
  const [choice, setChoice] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [discount, setDiscount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const raise = useAction(SHOWN[kind]);

  const nameOf = (code: string) => (groups.data ?? []).find((g) => g.code === code)?.name ?? code;
  const labelOf = (key: string) => (limitKeys.data ?? []).find((k) => k.key === key)?.label ?? key;
  const sold = (plans.data ?? []).filter((p) => p.status === 'ACTIVE');
  // the plan whose add-ons are on offer: the one chosen, or for an add-on the one the customer is on
  const offering: Plan | undefined = (plans.data ?? []).find(
    (p) => p.code === (kind === 'ADDON' ? subscription.plan?.code : planCode),
  );

  const local: Record<string, string> = {};
  const typed = discount.trim();
  const percent = typed === '' ? undefined : Number(typed);
  if (percent !== undefined && (Number.isNaN(percent) || percent < 0 || percent > 100)) {
    local.extraDiscountPercent = 'Enter a percentage from 0 to 100';
  }
  const wholeAbove0 = (text: string) => /^[0-9]+$/.test(text.trim()) && Number(text) > 0;
  if (kind === 'ADDON' && choice.indexOf('LIMIT:') === 0 && quantity.trim() !== '' && !wholeAbove0(quantity)) {
    local.quantity = 'Enter a whole number above 0';
  }
  const discounted = percent !== undefined && percent > 0;
  if (discounted && reason.trim() === '') local.extraDiscountReason = 'Say why the discount is given';

  let body: QuoteRequest | null = null;
  if (kind === 'NEW' || kind === 'CHANGE') {
    if (planCode && (kind === 'CHANGE' || startDate)) {
      const addOns: SubscriptionAddOnInput[] = [
        ...(offering?.addOns ?? [])
          .filter((a) => groupAddOns.indexOf(a.groupCode) >= 0)
          .map((a) => ({ kind: 'GROUP' as const, groupCode: a.groupCode })),
        ...(offering?.limitAddOns ?? [])
          .filter((a) => Number(extra[a.key]) > 0)
          .map((a) => ({ kind: 'LIMIT' as const, limitKey: a.key, quantity: Number(extra[a.key]) })),
      ];
      body = kind === 'NEW' ? { kind, planCode, startDate, addOns } : { kind, planCode, addOns };
    }
  } else if (kind === 'RENEWAL') {
    body = { kind, keepAddOnIds: subscription.addOns.filter((a) => keep.indexOf(a.id) >= 0).map((a) => a.id) };
  } else if (choice.indexOf('GROUP:') === 0) {
    body = { kind, addOn: { kind: 'GROUP', groupCode: choice.slice(6) } };
  } else if (choice.indexOf('LIMIT:') === 0 && wholeAbove0(quantity)) {
    body = { kind, addOn: { kind: 'LIMIT', limitKey: choice.slice(6), quantity: Number(quantity) } };
  }
  if (body && discounted) body = { ...body, extraDiscountPercent: percent, extraDiscountReason: reason.trim() };
  const request = Object.keys(local).length > 0 ? null : body;

  const priced = useQuote(request, (t, r) => quoteFor(t, customerId, r));
  const refused =
    priced.problem instanceof ApiError && priced.problem.code === 'VALIDATION' ? (priced.problem.fields ?? {}) : {};
  const fieldErrors: Record<string, string> = { ...refused, ...raise.fieldErrors, ...local };
  // what the server refused about something this form has no field for, e.g. "Renewal opens on 2 Dec 2026"
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
          : messageFor(priced.problem);

  const onRaise = async () => {
    if (!request || !priced.matches) return;
    const order = await raise.run(() => raiseOrder(token as string, customerId, request), raiseProblem);
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

  const limitOffer = (offers.data?.addOns ?? []).filter(
    (a) => a.kind === 'LIMIT' && `LIMIT:${a.limitKey}` === choice,
  )[0];
  const heldLabel = (a: Subscription['addOns'][number]) =>
    a.kind === 'GROUP' ? nameOf(a.groupCode as string) : `${a.quantity} extra ${labelOf(a.limitKey as string)}`;

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="order-dialog-title">
      <ModalHeader title={TITLE[kind]} labelId="order-dialog-title" />
      <ModalBody>
        <Form
          id="order-dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onRaise();
          }}
        >
          {raise.error && <Alert variant="danger" isInline title={raise.error} />}
          {plans.error && <Alert variant="danger" isInline title={plans.error} />}
          {(kind === 'NEW' || kind === 'CHANGE') && (
            <FormGroup label="Plan" isRequired fieldId="order-plan">
              <FormSelect id="order-plan" value={planCode} onChange={(_e, v) => setPlanCode(v)}>
                <FormSelectOption value="" label="Choose a plan" isPlaceholder />
                {sold.map((p) => (
                  <FormSelectOption
                    key={p.code}
                    value={p.code}
                    label={`${p.name} · ${PERIOD_LABEL[p.period]} · ${formatMoney(p.discountedPrice, 'INR')}`}
                  />
                ))}
              </FormSelect>
              {problem(
                'planCode',
                kind === 'CHANGE'
                  ? 'The new term starts today; the unused days of the present one are credited.'
                  : undefined,
              )}
            </FormGroup>
          )}
          {kind === 'NEW' && (
            <FormGroup label="Start date" isRequired fieldId="order-start">
              <TextInput id="order-start" type="date" value={startDate} onChange={(_e, v) => setStartDate(v)} />
              {problem('startDate')}
            </FormGroup>
          )}
          {(kind === 'NEW' || kind === 'CHANGE') &&
            offering &&
            (offering.addOns.length > 0 || offering.limitAddOns.length > 0) && (
              <FormGroup role="group" label="Add-ons" fieldId="order-addons">
                {offering.addOns.map((a) => (
                  <Checkbox
                    key={a.groupCode}
                    id={`order-addon-${a.groupCode}`}
                    label={`${nameOf(a.groupCode)} (${formatMoney(a.price, 'INR')})`}
                    isChecked={groupAddOns.indexOf(a.groupCode) >= 0}
                    onChange={(_e, on) =>
                      setGroupAddOns((list) =>
                        on
                          ? [...list.filter((c) => c !== a.groupCode), a.groupCode]
                          : list.filter((c) => c !== a.groupCode),
                      )
                    }
                  />
                ))}
                {offering.limitAddOns.map((a) => (
                  <TextInput
                    key={a.key}
                    aria-label={`Extra ${labelOf(a.key)}`}
                    type="number"
                    placeholder={`Extra ${labelOf(a.key).toLowerCase()}, in steps of ${a.unit}`}
                    value={extra[a.key] ?? ''}
                    onChange={(_e, v) => setExtra((x) => ({ ...x, [a.key]: v }))}
                  />
                ))}
                {problem('addOns')}
              </FormGroup>
            )}
          {kind === 'RENEWAL' && subscription.addOns.length > 0 && (
            <FormGroup role="group" label="Add-ons to keep" fieldId="order-keep">
              {subscription.addOns.map((a) => (
                <Checkbox
                  key={a.id}
                  id={`order-keep-${a.id}`}
                  label={heldLabel(a)}
                  isChecked={keep.indexOf(a.id) >= 0}
                  onChange={(_e, on) => setKeep((list) => (on ? [...list, a.id] : list.filter((id) => id !== a.id)))}
                />
              ))}
            </FormGroup>
          )}
          {kind === 'ADDON' && (
            <FormGroup label="Add-on" isRequired fieldId="order-addon">
              <FormSelect
                id="order-addon"
                value={choice}
                onChange={(_e, v) => {
                  setChoice(v);
                  setQuantity('');
                }}
              >
                <FormSelectOption value="" label="Choose an add-on" isPlaceholder />
                {(offers.data?.addOns ?? []).map((a) =>
                  a.kind === 'GROUP' ? (
                    <FormSelectOption
                      key={`g:${a.groupCode}`}
                      value={`GROUP:${a.groupCode}`}
                      label={`${a.name} · ${formatMoney(a.unitPrice, 'INR')} for a full term`}
                    />
                  ) : (
                    <FormSelectOption
                      key={`l:${a.limitKey}`}
                      value={`LIMIT:${a.limitKey}`}
                      label={`${a.name} · ${formatMoney(a.unitPrice, 'INR')} per ${a.unit} for a full term`}
                    />
                  ),
                )}
              </FormSelect>
              {problem('addOn', 'Charged for the days left in the term')}
            </FormGroup>
          )}
          {kind === 'ADDON' && limitOffer && (
            <FormGroup label="How many more" isRequired fieldId="order-quantity">
              <TextInput id="order-quantity" type="number" value={quantity} onChange={(_e, v) => setQuantity(v)} />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant={local.quantity ? 'error' : 'default'}>
                    {local.quantity ?? `Sold in steps of ${limitOffer.unit}`}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          )}
          <FormGroup label="Extra discount %" fieldId="order-discount">
            <TextInput id="order-discount" type="number" value={discount} onChange={(_e, v) => setDiscount(v)} />
            {problem('extraDiscountPercent', "On top of the plan's own discount; leave empty for none")}
          </FormGroup>
          {(discounted || reason !== '') && (
            <FormGroup label="Reason for the discount" isRequired fieldId="order-discount-reason">
              <TextInput id="order-discount-reason" value={reason} onChange={(_e, v) => setReason(v)} />
              {problem('extraDiscountReason')}
            </FormGroup>
          )}
          <QuotePanel quote={priced.quote} pending={priced.pending} error={quoteError} zone={subscription.zone} />
          <SetUpHint problem={priced.problem} canSettings={canSettings} />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="order-dialog-form"
          isDisabled={!priced.matches || raise.busy}
          isLoading={raise.busy}
        >
          Raise order
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
