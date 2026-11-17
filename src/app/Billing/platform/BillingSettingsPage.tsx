import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Radio,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { type BillingSettings, type WithoutPlan, getBillingSettings, putBillingSettings } from '@app/api/billing';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

const FIELDS = ['zone', 'graceDays', 'customersWithoutPlan'];

const SettingsForm: React.FunctionComponent<{ loaded: BillingSettings }> = ({ loaded }) => {
  const { token } = useSession();
  const [version, setVersion] = React.useState(loaded.version);
  const [zone, setZone] = React.useState(loaded.zone);
  const [graceDays, setGraceDays] = React.useState(String(loaded.graceDays));
  const [withoutPlan, setWithoutPlan] = React.useState<WithoutPlan>(loaded.customersWithoutPlan);
  const [saved, setSaved] = React.useState(false);
  const [graceError, setGraceError] = React.useState<string | undefined>(undefined);
  const action = useAction(FIELDS);

  const save = async () => {
    setSaved(false);
    // a blank is not "no grace": that would turn every customer past its term read-only at once
    if (graceDays.trim() === '' || Number.isNaN(Number(graceDays))) {
      setGraceError('Enter the number of grace days (0 for none)');
      return;
    }
    setGraceError(undefined);
    const result = await action.run(() =>
      putBillingSettings(token as string, {
        zone: zone.trim(),
        graceDays: Number(graceDays),
        customersWithoutPlan: withoutPlan,
        version,
      }),
    );
    if (result) {
      setVersion(result.version);
      setSaved(true);
    }
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
    <Form
      isWidthLimited
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {action.error && <Alert variant="danger" isInline title={action.error} />}
      {saved && <Alert variant="success" isInline title="Settings saved" />}
      <FormGroup label="Time zone" isRequired fieldId="billing-zone">
        <TextInput id="billing-zone" isRequired value={zone} onChange={(_e, v) => setZone(v)} />
        {error('zone') ?? (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>Days begin and end in this zone. Terms already assigned keep their dates.</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
      <FormGroup label="Grace days" isRequired fieldId="billing-grace">
        <TextInput id="billing-grace" type="number" value={graceDays} onChange={(_e, v) => setGraceDays(v)} />
        {graceError ? (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{graceError}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        ) : (
          error('graceDays')
        )}
        {!graceError && !action.fieldErrors.graceDays && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>Days of full use after a term ends, before the account turns read-only.</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
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
        {error('customersWithoutPlan')}
        {withoutPlan === 'READ_ONLY' && (
          <Alert
            variant="warning"
            isInline
            isPlain
            title="Read-only stops every customer that has no plan from changing anything. Give every live customer a plan first."
          />
        )}
      </FormGroup>
      <div>
        <Button variant="primary" type="submit" isDisabled={action.busy}>
          Save
        </Button>
      </div>
    </Form>
  );
};

/** Platform staff: the billing zone, the grace period and how customers without a plan are treated. */
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
