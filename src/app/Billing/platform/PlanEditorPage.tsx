import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Label,
  Spinner,
  Switch,
  TextArea,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import {
  type BillingPeriod,
  type FeatureGroup,
  type LimitKeyInfo,
  PERIODS,
  PERIOD_LABEL,
  type Plan,
  createPlan,
  getPlan,
  listGroups,
  listLimitKeys,
  updatePlan,
} from '@app/api/billing';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { PlanStatusLabel } from '@app/Billing/platform/PlansTab';
import { PriceSummary } from '@app/Billing/platform/PriceSummary';
import {
  type GroupMode,
  type PlanDraft,
  fieldProblems,
  priceItems,
  requiresProblems,
  setGroupMode,
  toDraft,
  toInput,
} from '@app/Billing/platform/planDraft';

const FIELDS = [
  'code',
  'name',
  'period',
  'rank',
  'discountPercent',
  'items',
  'addOns',
  'limits',
  'limitAddOns',
  'rates',
  'status',
];
const MODES: { mode: GroupMode; text: string }[] = [
  { mode: 'INCLUDED', text: 'Included' },
  { mode: 'ADDON', text: 'Add-on' },
  { mode: 'NONE', text: 'Not available' },
];
const BACK = '/platform/plans';

const FieldError: React.FunctionComponent<{ message?: string }> = ({ message }) =>
  message ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{message}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

const PlanForm: React.FunctionComponent<{
  plan: Plan | null;
  groups: FeatureGroup[];
  limitKeys: LimitKeyInfo[];
  onSaved(plan: Plan): void;
}> = ({ plan, groups, limitKeys, onSaved }) => {
  const { token } = useSession();
  const canManage = useAccess().has('plan:manage');
  const readOnly = !canManage || plan?.status === 'RETIRED';
  const [draft, setDraft] = React.useState<PlanDraft>(() => toDraft(plan, groups, limitKeys));
  const action = useAction(FIELDS);
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const paid = groups.filter((g) => g.category === 'PAID').sort((a, b) => a.sortOrder - b.sortOrder);
  const free = groups.filter((g) => g.category === 'DEFAULT').sort((a, b) => a.sortOrder - b.sortOrder);
  const problems = requiresProblems(draft, groups);
  const missing = fieldProblems(draft, groups, limitKeys);
  const blocked = Object.keys(problems).length > 0 || Object.keys(missing).length > 0;

  const save = async () => {
    const input = toInput(draft);
    const saved = await action.run(() =>
      plan
        ? updatePlan(token as string, plan.code, { ...input, version: plan.version })
        : createPlan(token as string, input),
    );
    if (saved) onSaved(saved);
  };

  const setLimit = (key: string, field: 'limit' | 'unitPrice' | 'unit', value: string) =>
    setDraft((d) => ({ ...d, limits: { ...d.limits, [key]: { ...d.limits[key], [field]: value } } }));

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {action.error && <Alert variant="danger" isInline title={action.error} />}
      {action.fieldErrors.status && <Alert variant="danger" isInline title={action.fieldErrors.status} />}
      {plan?.status === 'ACTIVE' && !readOnly && (
        <Alert variant="info" isInline isPlain title="Changes apply to customers at their next renewal." />
      )}
      <Card isCompact>
        <CardTitle>Plan</CardTitle>
        <CardBody>
          <Flex direction={{ default: 'column' }} gap={{ default: 'gapMd' }}>
            {!plan && (
              <FormGroup label="Code" isRequired fieldId="plan-code">
                <TextInput id="plan-code" isRequired value={draft.code} onChange={(_e, v) => set('code', v)} />
                <FieldError message={action.fieldErrors.code} />
              </FormGroup>
            )}
            <FormGroup label="Name" isRequired fieldId="plan-name">
              <TextInput
                id="plan-name"
                isRequired
                isDisabled={readOnly}
                value={draft.name}
                onChange={(_e, v) => set('name', v)}
              />
              <FieldError message={action.fieldErrors.name} />
            </FormGroup>
            <FormGroup label="Description" fieldId="plan-description">
              <TextArea
                id="plan-description"
                isDisabled={readOnly}
                value={draft.description}
                onChange={(_e, v) => set('description', v)}
              />
            </FormGroup>
            <Flex gap={{ default: 'gapLg' }}>
              <FlexItem>
                <FormGroup label="Period" isRequired fieldId="plan-period">
                  <FormSelect
                    id="plan-period"
                    isDisabled={readOnly}
                    value={draft.period}
                    onChange={(_e, v) => set('period', v as BillingPeriod)}
                  >
                    {PERIODS.map((p) => (
                      <FormSelectOption key={p} value={p} label={PERIOD_LABEL[p]} />
                    ))}
                  </FormSelect>
                  <FieldError message={action.fieldErrors.period} />
                </FormGroup>
              </FlexItem>
              <FlexItem>
                <FormGroup label="Rank" isRequired fieldId="plan-rank">
                  <TextInput
                    id="plan-rank"
                    type="number"
                    isDisabled={readOnly}
                    value={draft.rank}
                    onChange={(_e, v) => set('rank', v)}
                  />
                  <FieldError message={action.fieldErrors.rank ?? missing.rank} />
                  {!action.fieldErrors.rank && !missing.rank && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>
                          A higher rank is a higher plan. Periods of one tier share a rank.
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </FormGroup>
              </FlexItem>
            </Flex>
            <Switch
              id="plan-offered"
              label="Customers can choose this plan themselves"
              isDisabled={readOnly}
              isChecked={draft.offered}
              onChange={(_e, on) => set('offered', on)}
            />
          </Flex>
        </CardBody>
      </Card>

      <Card isCompact>
        <CardTitle>Feature groups</CardTitle>
        <CardBody>
          <Content component="p">
            Always included, free:{' '}
            {free.map((g) => (
              <Label key={g.code} isCompact color="grey" style={{ marginInlineEnd: 4 }}>
                {g.name}
              </Label>
            ))}
          </Content>
          <FieldError message={action.fieldErrors.items} />
          <FieldError message={action.fieldErrors.addOns} />
          {paid.map((g) => {
            const row = draft.groups[g.code] ?? { mode: 'NONE' as GroupMode, price: '' };
            return (
              <fieldset key={g.code} aria-label={g.name} style={{ border: 0, padding: '8px 0', margin: 0 }}>
                <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
                  <FlexItem style={{ minWidth: 140 }}>
                    <strong>{g.name}</strong>
                  </FlexItem>
                  <FlexItem>
                    <ToggleGroup aria-label={`How the plan has ${g.name}`}>
                      {MODES.map((m) => (
                        <ToggleGroupItem
                          key={m.mode}
                          text={m.text}
                          isDisabled={readOnly}
                          isSelected={row.mode === m.mode}
                          onChange={() => setDraft((d) => setGroupMode(d, g.code, m.mode))}
                        />
                      ))}
                    </ToggleGroup>
                  </FlexItem>
                  <FlexItem>
                    <TextInput
                      aria-label={`Price of ${g.name}`}
                      type="number"
                      placeholder="₹ per period"
                      isDisabled={readOnly || row.mode === 'NONE'}
                      value={row.price}
                      onChange={(_e, v) =>
                        setDraft((d) => ({ ...d, groups: { ...d.groups, [g.code]: { ...row, price: v } } }))
                      }
                    />
                  </FlexItem>
                </Flex>
                <FieldError message={problems[g.code] ?? missing[`group:${g.code}`]} />
              </fieldset>
            );
          })}
          <FormGroup label="Discount %" fieldId="plan-discount">
            <TextInput
              id="plan-discount"
              type="number"
              isDisabled={readOnly}
              value={draft.discountPercent}
              onChange={(_e, v) => set('discountPercent', v)}
            />
            <FieldError message={action.fieldErrors.discountPercent} />
          </FormGroup>
          <PriceSummary
            items={priceItems(draft)}
            discountPercent={Number(draft.discountPercent || 0)}
            period={draft.period}
            saved={plan}
            live={!readOnly}
          />
        </CardBody>
      </Card>

      <Card isCompact>
        <CardTitle>Limits</CardTitle>
        <CardBody>
          <Content component="small">
            Leave a limit blank for unlimited. Extra units are what a customer can buy on top.
          </Content>
          <FieldError message={action.fieldErrors.limits} />
          <FieldError message={action.fieldErrors.limitAddOns} />
          {limitKeys.map((k) => {
            const row = draft.limits[k.key] ?? { limit: '', unitPrice: '', unit: '' };
            return (
              <fieldset key={k.key} aria-label={k.label} style={{ border: 0, padding: '6px 0', margin: 0 }}>
                <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
                  <FlexItem style={{ minWidth: 260 }}>{k.label}</FlexItem>
                  <FlexItem>
                    <TextInput
                      aria-label={`Limit on ${k.label}`}
                      type="number"
                      placeholder="Unlimited"
                      isDisabled={readOnly}
                      value={row.limit}
                      onChange={(_e, v) => setLimit(k.key, 'limit', v)}
                    />
                  </FlexItem>
                  <FlexItem>Extra units: ₹</FlexItem>
                  <FlexItem>
                    <TextInput
                      aria-label={`Price of extra ${k.label}`}
                      type="number"
                      isDisabled={readOnly || (row.limit.trim() === '' && row.unitPrice === '')}
                      value={row.unitPrice}
                      onChange={(_e, v) => setLimit(k.key, 'unitPrice', v)}
                    />
                  </FlexItem>
                  <FlexItem>per</FlexItem>
                  <FlexItem>
                    <TextInput
                      aria-label={`Extra ${k.label} per unit`}
                      type="number"
                      isDisabled={readOnly || (row.limit.trim() === '' && row.unit === '')}
                      value={row.unit}
                      onChange={(_e, v) => setLimit(k.key, 'unit', v)}
                    />
                  </FlexItem>
                </Flex>
                <FieldError message={missing[`limit:${k.key}`]} />
              </fieldset>
            );
          })}
        </CardBody>
      </Card>

      <Card isCompact>
        <CardTitle>Usage</CardTitle>
        <CardBody>
          <FormGroup label="₹ per WhatsApp message sent" fieldId="plan-message-rate">
            <TextInput
              id="plan-message-rate"
              type="number"
              placeholder="Free"
              isDisabled={readOnly}
              value={draft.messageRate}
              onChange={(_e, v) => set('messageRate', v)}
            />
            <FieldError message={action.fieldErrors.rates} />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Up to 4 decimals; leave it empty to charge nothing. Each message sent is taken from the customer's
                  wallet. A new rate reaches a customer with its next term: a renewal, or a plan change.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </CardBody>
      </Card>

      {!readOnly && (
        <Flex>
          <FlexItem>
            <Button variant="primary" type="submit" isDisabled={action.busy || blocked}>
              {plan ? 'Save' : 'Create plan'}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="link" component={(props) => <Link {...props} to={BACK} />}>
              Cancel
            </Button>
          </FlexItem>
        </Flex>
      )}
    </Form>
  );
};

/** Creates a plan (`/platform/plans/new`) or edits one. Read-only for people who may only look, and for a retired plan. */
export const PlanEditorPage: React.FunctionComponent = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const isNew = code === undefined;
  const plan = useLoad((t) => (isNew ? Promise.resolve(null) : getPlan(t, code as string)), [code]);
  const groups = useLoad(listGroups);
  const limitKeys = useLoad(listLimitKeys);
  // a saved plan is shown again from what the server returned, with its new version
  const [saved, setSaved] = React.useState<Plan | null>(null);
  const current = saved && saved.code === code ? saved : (plan.data ?? null);

  const error = plan.error ?? groups.error ?? limitKeys.error;
  const ready = groups.data && limitKeys.data && (isNew || current);

  return (
    <PageShell
      title={isNew ? 'New plan' : (current?.name ?? 'Plan')}
      actions={
        <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
          {current && (
            <FlexItem>
              <PlanStatusLabel status={current.status} />
            </FlexItem>
          )}
          <FlexItem>
            <Link to={BACK}>All plans</Link>
          </FlexItem>
        </Flex>
      }
    >
      {error && <Alert variant="danger" isInline title={error} />}
      {!ready && !error && <Spinner aria-label="Loading plan" />}
      {ready && (
        <PlanForm
          key={`${current?.code ?? 'new'}-${current?.version ?? 0}`}
          plan={current}
          groups={groups.data ?? []}
          limitKeys={limitKeys.data ?? []}
          onSaved={(p) => {
            setSaved(p);
            if (isNew) navigate(`${BACK}/${encodeURIComponent(p.code)}`);
          }}
        />
      )}
    </PageShell>
  );
};
