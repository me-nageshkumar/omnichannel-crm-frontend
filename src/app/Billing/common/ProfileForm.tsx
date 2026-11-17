import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem, TextArea, TextInput } from '@patternfly/react-core';
import type { BillingProfile, BillingProfileInput, IndianState } from '@app/api/billing';
import { StateSelect } from '@app/Billing/common/StateSelect';

export const PROFILE_FIELDS = ['legalName', 'address', 'stateCode', 'gstin'];

export const profileInput = (p: BillingProfile | undefined): BillingProfileInput => ({
  legalName: p?.legalName ?? '',
  address: p?.address ?? '',
  stateCode: p?.stateCode ?? '',
  gstin: p?.gstin ?? '',
});

const Problem: React.FunctionComponent<{ text?: string; hint?: string }> = ({ text, hint }) =>
  text || hint ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant={text ? 'error' : 'default'}>{text ?? hint}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

/** Who a customer is on its invoices: the fields staff and the customer itself both fill in. */
export const ProfileForm: React.FunctionComponent<{
  value: BillingProfileInput;
  states: IndianState[];
  readOnly?: boolean;
  errors: Record<string, string>;
  onChange(value: BillingProfileInput): void;
}> = ({ value, states, readOnly, errors, onChange }) => {
  const set = (field: keyof BillingProfileInput) => (v: string) => onChange({ ...value, [field]: v });
  return (
    <>
      <FormGroup label="Legal name" isRequired fieldId="profile-legal-name">
        <TextInput
          id="profile-legal-name"
          isRequired
          value={value.legalName}
          isDisabled={readOnly}
          onChange={(_e, v) => set('legalName')(v)}
        />
        <Problem text={errors.legalName} hint="The name invoices are made out to" />
      </FormGroup>
      <FormGroup label="Address" isRequired fieldId="profile-address">
        <TextArea
          id="profile-address"
          isRequired
          rows={3}
          value={value.address}
          isDisabled={readOnly}
          onChange={(_e, v) => set('address')(v)}
        />
        <Problem text={errors.address} />
      </FormGroup>
      <FormGroup label="State" isRequired fieldId="profile-state">
        <StateSelect
          id="profile-state"
          value={value.stateCode}
          states={states}
          isDisabled={readOnly}
          onChange={set('stateCode')}
        />
        <Problem text={errors.stateCode} hint="Decides whether GST is charged as CGST and SGST, or as IGST" />
      </FormGroup>
      <FormGroup label="GSTIN" fieldId="profile-gstin">
        <TextInput
          id="profile-gstin"
          value={value.gstin}
          isDisabled={readOnly}
          onChange={(_e, v) => set('gstin')(v.toUpperCase())}
        />
        <Problem text={errors.gstin} hint="Leave empty if not registered for GST" />
      </FormGroup>
    </>
  );
};
