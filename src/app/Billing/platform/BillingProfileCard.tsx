import * as React from 'react';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Spinner } from '@patternfly/react-core';
import { getBillingProfile, listStates, putBillingProfile } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { ProfileDetails, ProfileModal } from '@app/Billing/common/ProfileModal';

/** Who the customer is on its invoices, on its page for platform staff. */
export const BillingProfileCard: React.FunctionComponent<{ customerId: string }> = ({ customerId }) => {
  const { token } = useSession();
  const canManage = useAccess().has('subscription:manage');
  const profile = useLoad((t) => getBillingProfile(t, customerId), [customerId]);
  const states = useLoad(listStates);
  const [editing, setEditing] = React.useState(false);
  const p = profile.data;
  return (
    <Card component="section" aria-label="Billing profile" id="billing-profile">
      <CardHeader
        actions={{
          actions:
            p && canManage ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : undefined,
        }}
      >
        <CardTitle>Billing profile</CardTitle>
      </CardHeader>
      <CardBody>
        {profile.error && <Alert variant="danger" isInline title={profile.error} />}
        {states.error && (
          <Alert variant="warning" isInline title={`The list of states could not be loaded. ${states.error}`} />
        )}
        {!p && !profile.error && <Spinner aria-label="Loading billing profile" />}
        {p && !p.legalName && (
          <Alert variant="info" isInline isPlain title="Not filled in yet">
            An order can be raised once the legal name, address and state are here: they go on the invoice.
          </Alert>
        )}
        {p && p.legalName && <ProfileDetails profile={p} states={states.data ?? []} />}
      </CardBody>
      {editing && p && (
        <ProfileModal
          title="Billing profile"
          current={p}
          states={states.data ?? []}
          save={(input) => putBillingProfile(token as string, customerId, input)}
          onSaved={(saved) => {
            profile.setData(() => saved);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </Card>
  );
};
