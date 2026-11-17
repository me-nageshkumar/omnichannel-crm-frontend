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
  type FeatureGroup,
  type LimitKeyInfo,
  PERIOD_LABEL,
  PERIOD_MONTHS,
  type Plan,
  type Subscription,
  type SubscriptionAddOnInput,
  listGroups,
  listLimitKeys,
  listPlans,
  putCustomerSubscription,
} from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { formatMoney } from '@app/Crm/common/money';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { localDateIn, todayIn } from '@app/Billing/common/billingDate';
import { addMonths } from '@app/Billing/common/planDates';

const FIELDS = ['planCode', 'startDate', 'endDate', 'addOns'];

const conflict = (e: unknown) =>
  e instanceof ApiError && e.status === 409
    ? 'Someone else changed this subscription. Close this, look at it again, and repeat the change.'
    : messageFor(e);

/**
 * Puts a customer on a plan, or changes the plan it is on: the plan, the term's first day and the day after its last,
 * and any add-ons. Nothing is charged; the customer's users feel the change at once.
 */
export const AssignPlanModal: React.FunctionComponent<{
  customerId: string;
  current: Subscription;
  onSaved(subscription: Subscription): void;
  onCancel(): void;
}> = ({ customerId, current, onSaved, onCancel }) => {
  const { token } = useSession();
  const plans = useLoad((t) => listPlans(t));
  const groups = useLoad(listGroups);
  const limitKeys = useLoad(listLimitKeys);
  const [planCode, setPlanCode] = React.useState(current.plan?.code ?? '');
  // a change starts from the term the customer is on; only a first assignment starts today
  const [startDate, setStartDate] = React.useState(() =>
    current.plan && current.termStart ? localDateIn(current.termStart, current.zone) : todayIn(current.zone),
  );
  const [endDate, setEndDate] = React.useState(() =>
    current.plan && current.termEnd ? localDateIn(current.termEnd, current.zone) : '',
  );
  /** The plan and start date the end date was last worked out from; the term on file counts as worked out. */
  const prefilledFor = React.useRef(current.plan ? `${current.plan.code}|${startDate}` : '');
  /** Add-ons the customer holds that the chosen plan does not list; kept unless unticked. */
  const [dropped, setDropped] = React.useState<string[]>([]);
  const [groupAddOns, setGroupAddOns] = React.useState<string[]>(
    current.addOns.filter((a) => a.kind === 'GROUP' && a.groupCode).map((a) => a.groupCode as string),
  );
  const [extra, setExtra] = React.useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    current.addOns.forEach((a) => {
      if (a.kind === 'LIMIT' && a.limitKey) out[a.limitKey] = String(a.quantity ?? '');
    });
    return out;
  });
  const action = useAction(FIELDS);

  // an active plan, or the retired one the customer is already on
  const offered = (plans.data ?? []).filter((p) => p.status === 'ACTIVE' || p.code === current.plan?.code);
  const plan: Plan | undefined = offered.find((p) => p.code === planCode);
  const months = plan ? PERIOD_MONTHS[plan.period] : 0;

  React.useEffect(() => {
    const key = `${planCode}|${startDate}`;
    if (months === 0 || !startDate || prefilledFor.current === key) return;
    prefilledFor.current = key;
    setEndDate(addMonths(startDate, months));
  }, [months, startDate, planCode]);

  const nameOf = (code: string) => (groups.data ?? []).find((g: FeatureGroup) => g.code === code)?.name ?? code;
  const labelOf = (key: string) => (limitKeys.data ?? []).find((k: LimitKeyInfo) => k.key === key)?.label ?? key;
  const addOnGroups = plan ? plan.addOns : [];
  const addOnLimits = plan ? plan.limitAddOns : [];
  // what the customer holds that this plan neither includes nor lists as an add-on (the plan was edited since)
  const unlisted = !plan
    ? []
    : current.addOns.filter((a) =>
        a.kind === 'GROUP'
          ? !!a.groupCode &&
            !plan.addOns.some((x) => x.groupCode === a.groupCode) &&
            !plan.items.some((x) => x.groupCode === a.groupCode)
          : !!a.limitKey &&
            !plan.limitAddOns.some((x) => x.key === a.limitKey) &&
            plan.limits[a.limitKey] !== undefined,
      );

  const save = async () => {
    const addOns: SubscriptionAddOnInput[] = [
      ...addOnGroups
        .filter((a) => groupAddOns.includes(a.groupCode))
        .map((a) => ({ kind: 'GROUP' as const, groupCode: a.groupCode })),
      ...addOnLimits
        .filter((a) => Number(extra[a.key]) > 0)
        .map((a) => ({ kind: 'LIMIT' as const, limitKey: a.key, quantity: Number(extra[a.key]) })),
      ...unlisted
        .filter((a) => !dropped.includes(a.id))
        .map((a) =>
          a.kind === 'GROUP'
            ? { kind: 'GROUP' as const, groupCode: a.groupCode as string }
            : { kind: 'LIMIT' as const, limitKey: a.limitKey as string, quantity: a.quantity ?? 0 },
        ),
    ];
    const saved = await action.run(
      () =>
        putCustomerSubscription(token as string, customerId, {
          planCode,
          startDate,
          endDate,
          addOns,
          revision: current.plan ? current.revision : null,
        }),
      conflict,
    );
    if (saved) onSaved(saved);
  };

  const error = (field: string) =>
    action.fieldErrors[field] ? (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="error">{action.fieldErrors[field]}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    ) : null;

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="assign-plan-title">
      <ModalHeader title={current.plan ? 'Change plan' : 'Assign plan'} labelId="assign-plan-title" />
      <ModalBody>
        <Form
          id="assign-plan-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          {plans.error && <Alert variant="danger" isInline title={plans.error} />}
          <FormGroup label="Plan" isRequired fieldId="assign-plan-code">
            <FormSelect id="assign-plan-code" value={planCode} onChange={(_e, v) => setPlanCode(v)}>
              <FormSelectOption value="" label="Choose a plan" isPlaceholder />
              {offered.map((p) => (
                <FormSelectOption
                  key={p.code}
                  value={p.code}
                  label={`${p.name} · ${PERIOD_LABEL[p.period]} · ${formatMoney(p.discountedPrice, 'INR')}`}
                />
              ))}
            </FormSelect>
            {error('planCode')}
          </FormGroup>
          <FormGroup label="Start date" isRequired fieldId="assign-plan-start">
            <TextInput id="assign-plan-start" type="date" value={startDate} onChange={(_e, v) => setStartDate(v)} />
            {error('startDate')}
          </FormGroup>
          <FormGroup label="End date" isRequired fieldId="assign-plan-end">
            <TextInput id="assign-plan-end" type="date" value={endDate} onChange={(_e, v) => setEndDate(v)} />
            {error('endDate')}
            {!action.fieldErrors.endDate && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>The day after the last day of the term.</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          {(addOnGroups.length > 0 || addOnLimits.length > 0 || unlisted.length > 0) && (
            <FormGroup role="group" label="Add-ons" fieldId="assign-plan-addons">
              {addOnGroups.map((a) => (
                <Checkbox
                  key={a.groupCode}
                  id={`assign-plan-addon-${a.groupCode}`}
                  label={`${nameOf(a.groupCode)} (${formatMoney(a.price, 'INR')})`}
                  isChecked={groupAddOns.includes(a.groupCode)}
                  onChange={(_e, on) =>
                    setGroupAddOns((list) =>
                      on
                        ? [...list.filter((c) => c !== a.groupCode), a.groupCode]
                        : list.filter((c) => c !== a.groupCode),
                    )
                  }
                />
              ))}
              {addOnLimits.map((a) => (
                <TextInput
                  key={a.key}
                  aria-label={`Extra ${labelOf(a.key)}`}
                  type="number"
                  placeholder={`Extra ${labelOf(a.key).toLowerCase()} on top of ${plan?.limits[a.key] ?? 0}`}
                  value={extra[a.key] ?? ''}
                  onChange={(_e, v) => setExtra((x) => ({ ...x, [a.key]: v }))}
                />
              ))}
              {unlisted.map((a) => (
                <Checkbox
                  key={a.id}
                  id={`assign-plan-held-${a.id}`}
                  label={`${a.kind === 'GROUP' ? nameOf(a.groupCode as string) : `${a.quantity} extra ${labelOf(a.limitKey as string)}`} (held now; no longer offered by this plan)`}
                  isChecked={!dropped.includes(a.id)}
                  onChange={(_e, on) => setDropped((list) => (on ? list.filter((id) => id !== a.id) : [...list, a.id]))}
                />
              ))}
              {error('addOns')}
            </FormGroup>
          )}
          <Alert
            variant="info"
            isInline
            isPlain
            title="Nothing is charged. The customer's users get the change at once."
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="assign-plan-form" isDisabled={action.busy || !planCode}>
          {current.plan ? 'Change' : 'Assign'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
