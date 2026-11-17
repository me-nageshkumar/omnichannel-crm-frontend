import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Form,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@patternfly/react-core';
import {
  type BillingProfile,
  type BillingProfileInput,
  type IndianState,
  getBillingProfile,
  listStates,
  putBillingProfile,
} from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { PROFILE_FIELDS, ProfileForm, profileInput } from '@app/Billing/common/ProfileForm';
import { stateText } from '@app/Billing/common/StateSelect';

/** The server's own sentence when a waiting order stands in the way of a profile change. */
export const profileProblem = (e: unknown): string =>
  e instanceof ApiError && e.code === 'ORDER_PENDING' && e.serverMessage ? e.serverMessage : messageFor(e);

/** The fields of a billing profile, read-only. */
export const ProfileDetails: React.FunctionComponent<{ profile: BillingProfile; states: IndianState[] }> = ({
  profile,
  states,
}) => (
  <DescriptionList isHorizontal isCompact>
    <DescriptionListGroup>
      <DescriptionListTerm>Legal name</DescriptionListTerm>
      <DescriptionListDescription>{profile.legalName}</DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>Address</DescriptionListTerm>
      <DescriptionListDescription>{profile.address}</DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>State</DescriptionListTerm>
      <DescriptionListDescription>{stateText(profile.stateCode, states)}</DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>GSTIN</DescriptionListTerm>
      <DescriptionListDescription>{profile.gstin ?? 'Not registered for GST'}</DescriptionListDescription>
    </DescriptionListGroup>
  </DescriptionList>
);

const EditProfileModal: React.FunctionComponent<{
  customerId: string;
  current: BillingProfile;
  states: IndianState[];
  onSaved(profile: BillingProfile): void;
  onCancel(): void;
}> = ({ customerId, current, states, onSaved, onCancel }) => {
  const { token } = useSession();
  const [value, setValue] = React.useState<BillingProfileInput>(profileInput(current));
  const action = useAction(PROFILE_FIELDS);
  const save = async () => {
    const saved = await action.run(
      () => putBillingProfile(token as string, customerId, trimmed(value)),
      profileProblem,
    );
    if (saved) onSaved(saved);
  };
  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="billing-profile-title">
      <ModalHeader title="Billing profile" labelId="billing-profile-title" />
      <ModalBody>
        <Form
          id="billing-profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <ProfileForm value={value} states={states} errors={action.fieldErrors} onChange={setValue} />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="billing-profile-form" isDisabled={action.busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export const trimmed = (v: BillingProfileInput): BillingProfileInput => ({
  legalName: v.legalName.trim(),
  address: v.address.trim(),
  stateCode: v.stateCode,
  gstin: v.gstin.trim(),
});

/** Who the customer is on its invoices, on its page for platform staff. */
export const BillingProfileCard: React.FunctionComponent<{ customerId: string }> = ({ customerId }) => {
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
        {!p && !profile.error && <Spinner aria-label="Loading billing profile" />}
        {p && !p.complete && !p.legalName && (
          <Alert variant="info" isInline isPlain title="Not filled in yet">
            An order can be raised once the legal name, address and state are here: they go on the invoice.
          </Alert>
        )}
        {p && p.legalName && <ProfileDetails profile={p} states={states.data ?? []} />}
      </CardBody>
      {editing && p && (
        <EditProfileModal
          customerId={customerId}
          current={p}
          states={states.data ?? []}
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
