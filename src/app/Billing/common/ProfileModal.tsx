import * as React from 'react';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Form,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';
import type { BillingProfile, BillingProfileInput, IndianState } from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useAction } from '@app/admin/useAction';
import { PROFILE_FIELDS, ProfileForm, profileInput } from '@app/Billing/common/ProfileForm';
import { stateLabel } from '@app/Billing/common/StateSelect';

/** The server's own sentence when a waiting order stands in the way of a profile change. */
export const profileProblem = (e: unknown): string =>
  e instanceof ApiError && e.code === 'ORDER_PENDING' && e.serverMessage ? e.serverMessage : messageFor(e);

const trimmed = (v: BillingProfileInput): BillingProfileInput => ({
  legalName: v.legalName.trim(),
  address: v.address.trim(),
  stateCode: v.stateCode,
  gstin: v.gstin.trim(),
});

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
      <DescriptionListDescription>{stateLabel(profile.stateCode, states)}</DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>GSTIN</DescriptionListTerm>
      <DescriptionListDescription>{profile.gstin ?? 'Not registered for GST'}</DescriptionListDescription>
    </DescriptionListGroup>
  </DescriptionList>
);

/** Edits a billing profile; `save` sends it (for a customer by staff, or for the customer itself). */
export const ProfileModal: React.FunctionComponent<{
  title: string;
  current: BillingProfile;
  states: IndianState[];
  save(input: BillingProfileInput): Promise<BillingProfile>;
  onSaved(profile: BillingProfile): void;
  onCancel(): void;
}> = ({ title, current, states, save, onSaved, onCancel }) => {
  const [value, setValue] = React.useState<BillingProfileInput>(profileInput(current));
  const action = useAction(PROFILE_FIELDS);
  const submit = async () => {
    const saved = await action.run(() => save(trimmed(value)), profileProblem);
    if (saved) onSaved(saved);
  };
  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="billing-profile-title">
      <ModalHeader title={title} labelId="billing-profile-title" />
      <ModalBody>
        <Form
          id="billing-profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
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
