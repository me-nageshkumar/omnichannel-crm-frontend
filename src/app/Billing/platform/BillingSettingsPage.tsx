import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSection,
  HelperText,
  HelperTextItem,
  Radio,
  Spinner,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import {
  type BillingSettings,
  type WithoutPlan,
  getBillingSettings,
  listStates,
  putBillingSettings,
} from '@app/api/billing';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { StateSelect } from '@app/Billing/common/StateSelect';

const FIELDS = [
  'zone',
  'graceDays',
  'customersWithoutPlan',
  'supplierLegalName',
  'supplierAddress',
  'supplierStateCode',
  'supplierGstin',
  'sacCode',
  'gstRatePercent',
  'invoicePrefix',
  'creditNotePrefix',
  'quoteValidDays',
  'renewalWindowDays',
  'paymentInstructions',
];

/** The number fields, with what to say when one is left blank: a blank is never sent as 0. */
const NUMBERS: Record<string, string> = {
  graceDays: 'Enter the number of grace days (0 for none)',
  gstRatePercent: 'Enter the GST rate in percent',
  quoteValidDays: 'Enter for how many days a quote stays valid',
  renewalWindowDays: 'Enter how many days before the end a renewal can be asked for',
};

type Texts = Record<string, string>;

const textsOf = (s: BillingSettings): Texts => ({
  zone: s.zone,
  graceDays: String(s.graceDays),
  supplierLegalName: s.supplierLegalName ?? '',
  supplierAddress: s.supplierAddress ?? '',
  supplierStateCode: s.supplierStateCode ?? '',
  supplierGstin: s.supplierGstin ?? '',
  sacCode: s.sacCode ?? '',
  gstRatePercent: String(s.gstRatePercent),
  invoicePrefix: s.invoicePrefix,
  creditNotePrefix: s.creditNotePrefix,
  quoteValidDays: String(s.quoteValidDays),
  renewalWindowDays: String(s.renewalWindowDays),
  paymentInstructions: s.paymentInstructions ?? '',
});

const SettingsForm: React.FunctionComponent<{ loaded: BillingSettings }> = ({ loaded }) => {
  const { token } = useSession();
  const states = useLoad(listStates);
  const [version, setVersion] = React.useState(loaded.version);
  const [complete, setComplete] = React.useState(loaded.complete);
  const [texts, setTexts] = React.useState<Texts>(textsOf(loaded));
  const [withoutPlan, setWithoutPlan] = React.useState<WithoutPlan>(loaded.customersWithoutPlan);
  const [saved, setSaved] = React.useState(false);
  const [blank, setBlank] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);
  const set = (field: string) => (v: string) => setTexts((t) => ({ ...t, [field]: v }));

  const save = async () => {
    setSaved(false);
    const problems: Record<string, string> = {};
    Object.keys(NUMBERS).forEach((field) => {
      if (texts[field].trim() === '' || Number.isNaN(Number(texts[field]))) problems[field] = NUMBERS[field];
    });
    setBlank(problems);
    if (Object.keys(problems).length > 0) return;
    const result = await action.run(() =>
      putBillingSettings(token as string, {
        zone: texts.zone.trim(),
        graceDays: Number(texts.graceDays),
        customersWithoutPlan: withoutPlan,
        version,
        supplierLegalName: texts.supplierLegalName.trim(),
        supplierAddress: texts.supplierAddress.trim(),
        supplierStateCode: texts.supplierStateCode,
        supplierGstin: texts.supplierGstin.trim(),
        sacCode: texts.sacCode.trim(),
        gstRatePercent: Number(texts.gstRatePercent),
        invoicePrefix: texts.invoicePrefix.trim(),
        creditNotePrefix: texts.creditNotePrefix.trim(),
        quoteValidDays: Number(texts.quoteValidDays),
        renewalWindowDays: Number(texts.renewalWindowDays),
        paymentInstructions: texts.paymentInstructions.trim(),
      }),
    );
    if (result) {
      setVersion(result.version);
      setComplete(result.complete);
      setSaved(true);
    }
  };

  /** The problem with a field, else its hint. */
  const help = (field: string, hint?: string) => {
    const problem = blank[field] ?? action.fieldErrors[field];
    if (!problem && !hint) return null;
    return (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={problem ? 'error' : 'default'}>{problem ?? hint}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    );
  };
  const text = (field: string, label: string, hint?: string, required = false, type: 'text' | 'number' = 'text') => (
    <FormGroup label={label} isRequired={required} fieldId={`billing-${field}`}>
      <TextInput
        id={`billing-${field}`}
        type={type}
        isRequired={required}
        value={texts[field]}
        onChange={(_e, v) => set(field)(v)}
      />
      {help(field, hint)}
    </FormGroup>
  );

  return (
    <Form
      isWidthLimited
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {action.error && <Alert variant="danger" isInline title={action.error} />}
      {saved && <Alert variant="success" isInline title="Settings saved" />}
      {states.error && (
        <Alert variant="warning" isInline title={`The list of states could not be loaded. ${states.error}`} />
      )}
      {!complete && (
        <Alert
          variant="warning"
          isInline
          title="Fill in the supplier details: no order can be raised until they are complete."
        />
      )}
      <FormSection title="Terms">
        {text('zone', 'Time zone', 'Days begin and end in this zone. Terms already sold keep their dates.', true)}
        {text(
          'graceDays',
          'Grace days',
          'Days of full use after a term ends, before the account turns read-only.',
          true,
          'number',
        )}
        <FormGroup role="radiogroup" label="Customers without a plan" fieldId="billing-without-plan">
          <Radio
            id="billing-without-plan-unrestricted"
            name="billing-without-plan"
            label="Unrestricted"
            description="They use everything, as before plans existed"
            isChecked={withoutPlan === 'UNRESTRICTED'}
            onChange={() => setWithoutPlan('UNRESTRICTED')}
          />
          <Radio
            id="billing-without-plan-read-only"
            name="billing-without-plan"
            label="Read-only"
            description="They can look at their data and change nothing"
            isChecked={withoutPlan === 'READ_ONLY'}
            onChange={() => setWithoutPlan('READ_ONLY')}
          />
          {help('customersWithoutPlan')}
          {withoutPlan === 'READ_ONLY' && (
            <Alert
              variant="warning"
              isInline
              isPlain
              title="Read-only stops every customer that has no plan from changing anything. Give every live customer a plan first."
            />
          )}
        </FormGroup>
      </FormSection>
      <FormSection title="Supplier">
        {text('supplierLegalName', 'Legal name', 'Your company, as printed on every invoice')}
        <FormGroup label="Address" fieldId="billing-supplierAddress">
          <TextArea
            id="billing-supplierAddress"
            rows={3}
            value={texts.supplierAddress}
            onChange={(_e, v) => set('supplierAddress')(v)}
          />
          {help('supplierAddress')}
        </FormGroup>
        <FormGroup label="State" fieldId="billing-supplierStateCode">
          <StateSelect
            id="billing-supplierStateCode"
            value={texts.supplierStateCode}
            states={states.data ?? []}
            onChange={set('supplierStateCode')}
          />
          {help('supplierStateCode', 'A customer in this state is charged CGST and SGST; any other, IGST')}
        </FormGroup>
        {text('supplierGstin', 'GSTIN')}
        {text('sacCode', 'HSN/SAC code', 'The service code printed on invoices, for example 998314')}
      </FormSection>
      <FormSection title="Invoices">
        {text('gstRatePercent', 'GST rate %', 'Applies to orders raised from now on', true, 'number')}
        {text('invoicePrefix', 'Invoice prefix', 'Numbers read INV/26-27/000001', true)}
        {text('creditNotePrefix', 'Credit note prefix', undefined, true)}
        {text('quoteValidDays', 'Quote valid days', 'How long a request waits for its payment', true, 'number')}
        {text(
          'renewalWindowDays',
          'Renewal window days',
          'How many days before a term ends its renewal can be asked for',
          true,
          'number',
        )}
      </FormSection>
      <FormSection title="How customers pay">
        <FormGroup label="Payment instructions" fieldId="billing-paymentInstructions">
          <TextArea
            id="billing-paymentInstructions"
            rows={4}
            value={texts.paymentInstructions}
            onChange={(_e, v) => set('paymentInstructions')(v)}
          />
          {help(
            'paymentInstructions',
            'Your bank account or UPI id. A customer sees this beside a request that waits for payment.',
          )}
        </FormGroup>
      </FormSection>
      <div>
        <Button variant="primary" type="submit" isDisabled={action.busy}>
          Save
        </Button>
      </div>
    </Form>
  );
};

/** Platform staff: terms, the supplier printed on invoices, invoice numbering and how customers pay. */
export const BillingSettingsPage: React.FunctionComponent = () => {
  const settings = useLoad(getBillingSettings);
  return (
    <PageShell title="Billing settings">
      {settings.error && <Alert variant="danger" isInline title={settings.error} />}
      {!settings.data && !settings.error && <Spinner aria-label="Loading billing settings" />}
      {settings.data && <SettingsForm loaded={settings.data} />}
    </PageShell>
  );
};
