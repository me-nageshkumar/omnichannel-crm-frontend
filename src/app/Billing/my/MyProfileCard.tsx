import * as React from 'react';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Content, Spinner } from '@patternfly/react-core';
import { getMyProfile, listMyStates, putMyProfile } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { ProfileDetails, ProfileModal } from '@app/Billing/common/ProfileModal';

/**
 * The customer's own billing details, as printed on its invoices. While one of its requests waits for payment
 * they stay as they are: the request was priced, and will be invoiced, for them.
 */
export const MyProfileCard: React.FunctionComponent<{ canEdit: boolean; locked: boolean }> = ({ canEdit, locked }) => {
  const { token } = useSession();
  const profile = useLoad(getMyProfile);
  const states = useLoad(listMyStates);
  const [editing, setEditing] = React.useState(false);
  const p = profile.data;
  return (
    <Card component="section" aria-label="Billing details" id="billing-details">
      <CardHeader
        actions={{
          actions:
            p && canEdit ? (
              <Button variant="secondary" isDisabled={locked} onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : undefined,
        }}
      >
        <CardTitle>Billing details</CardTitle>
      </CardHeader>
      <CardBody>
        {profile.error && <Alert variant="danger" isInline title={profile.error} />}
        {!p && !profile.error && <Spinner aria-label="Loading billing details" />}
        {p && !p.complete && (
          <Alert variant="warning" isInline isPlain title="Fill in your billing details before sending a request.">
            Your legal name, address and state go on your invoices.
          </Alert>
        )}
        {p && p.legalName && <ProfileDetails profile={p} states={states.data ?? []} />}
        {p && canEdit && locked && (
          <Content component="small">
            These details cannot be changed while a request waits for payment. Cancel the request, or wait until it is
            paid.
          </Content>
        )}
      </CardBody>
      {editing && p && (
        <ProfileModal
          title="Billing details"
          current={p}
          states={states.data ?? []}
          save={(input) => putMyProfile(token as string, input)}
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
