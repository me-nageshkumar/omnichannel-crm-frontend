import * as React from 'react';
import { Label, LabelGroup } from '@patternfly/react-core';
import { ContactPicker, contactLabel } from '@app/Crm/deals/ContactPicker';
import { Field } from '@app/Crm/deals/fields';

export const MAX_OTHER_CONTACTS = 49;

export interface OtherContact {
  id: string;
  label: string;
}

/**
 * The deal form's other contacts: a picker limited to the deal's channel account, and the chosen ones as removable
 * chips. Everyone on a deal shares its number, so the picker offers nobody a save would refuse.
 */
export const OtherContactsField: React.FunctionComponent<{
  value: OtherContact[];
  onChange(next: OtherContact[]): void;
  channelAccountId?: string;
  primaryId: string;
  isDisabled?: boolean;
  /** Says why the field is disabled. */
  hint?: string;
  error?: string | null;
}> = ({ value, onChange, channelAccountId, primaryId, isDisabled, hint, error }) => {
  const full = value.length >= MAX_OTHER_CONTACTS;
  return (
    <Field
      label="Other contacts"
      fieldId="crm-deal-others"
      error={error}
      help={hint ?? (full ? `At most ${MAX_OTHER_CONTACTS} other contacts.` : "Contacts on this deal's number.")}
    >
      <ContactPicker
        id="crm-deal-others"
        value=""
        searchLabel="Search other contacts"
        channelAccountId={channelAccountId}
        exclude={[primaryId, ...value.map((o) => o.id)]}
        isDisabled={isDisabled || full}
        onChange={(id, contact) => {
          if (id && contact) onChange([...value, { id, label: contactLabel(contact) }]);
        }}
      />
      {value.length > 0 && (
        <LabelGroup aria-label="Other contacts on this deal" numLabels={MAX_OTHER_CONTACTS} className="pf-v6-u-mt-sm">
          {value.map((o) => (
            <Label
              key={o.id}
              variant="outline"
              closeBtnAriaLabel={`Remove ${o.label}`}
              onClose={isDisabled ? undefined : () => onChange(value.filter((x) => x.id !== o.id))}
            >
              {o.label}
            </Label>
          ))}
        </LabelGroup>
      )}
    </Field>
  );
};
