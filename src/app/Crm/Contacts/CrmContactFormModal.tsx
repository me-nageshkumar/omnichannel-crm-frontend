import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { searchCompanies, updateContact } from '@app/api/crm';
import type { ContactUpdate, CrmContact, CrmSettings, Ref } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';
import { isCode } from '@app/Crm/Settings/ConflictAlert';

const FIELDS = ['firstName', 'lastName', 'email', 'jobTitle', 'companyId', 'ownerId', 'source'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const withValue = (list: Ref[], extra: Ref | null | undefined): Ref[] =>
  extra && !list.some((r) => r.id === extra.id) ? [...list, extra] : list;

/** Edits a CRM contact's details. A blank value clears the field on the server. */
export const CrmContactFormModal: React.FunctionComponent<{
  contact: CrmContact;
  settings: CrmSettings;
  /** People who may own the contact besides the user. */
  owners?: Ref[];
  onSaved(contact: CrmContact): void;
  /** The server refused the save because the contact changed meanwhile; the caller fetches the fresh one. */
  onConflict?(): void;
  onClose(): void;
}> = ({ contact, settings, owners = [], onSaved, onConflict, onClose }) => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  // The version the fields were seeded from: a refetch while the form is open must not make stale fields look current.
  const [version] = React.useState(contact.version);
  const sources = settings.dealSources.filter((s) => s.active).sort((a, b) => a.position - b.position);
  const [firstName, setFirstName] = React.useState(contact.firstName ?? '');
  const [lastName, setLastName] = React.useState(contact.lastName ?? '');
  const [email, setEmail] = React.useState(contact.email ?? '');
  const [jobTitle, setJobTitle] = React.useState(contact.jobTitle ?? '');
  const [companyId, setCompanyId] = React.useState(contact.company?.id ?? '');
  const [ownerId, setOwnerId] = React.useState(contact.owner?.id ?? '');
  const [source, setSource] = React.useState(contact.source ?? '');
  const [checked, setChecked] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const action = useAction(FIELDS);

  // Task 9 swaps this select for the company typeahead.
  const companies = useLoad((t) => searchCompanies(t, ws, { sort: 'name,asc', page: 0, size: 100 }), [ws], {
    keepOnError: true,
  });
  const companyOptions = withValue(
    (companies.data?.items ?? []).map((c) => ({ id: c.id, name: c.name })),
    contact.company,
  );
  const me: Ref | null = user ? { id: user.id, name: `${user.name} (you)` } : null;
  const ownerOptions = withValue(
    withValue(
      owners.filter((o) => o.id !== me?.id),
      contact.owner && contact.owner.id !== me?.id ? contact.owner : null,
    ),
    me,
  ).sort((a, b) => a.name.localeCompare(b.name));

  const emailError =
    checked && email.trim() !== '' && !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : null;
  const err = (key: string, own: string | null = null) => own ?? action.fieldErrors[key] ?? null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    setConflict(false);
    if (email.trim() !== '' && !EMAIL.test(email.trim())) return;
    const body: ContactUpdate = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      jobTitle: jobTitle.trim(),
      companyId,
      ownerId,
      source,
      version,
    };
    const saved = await action.run(
      () => updateContact(token as string, ws, contact.id, body),
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          setConflict(true);
          onConflict?.();
          return '';
        }
        return (e as { serverMessage?: string }).serverMessage ?? 'Could not save the contact. Try again.';
      },
    );
    if (saved) onSaved(saved);
  };

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="crm-contact-title">
      <ModalHeader title="Edit contact" labelId="crm-contact-title" />
      <ModalBody>
        {conflict && (
          <Alert
            variant="warning"
            isInline
            isPlain
            title="Someone else changed this contact. Close this form and open the contact again to see their changes."
          />
        )}
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="crm-contact-form" onSubmit={onSubmit}>
          <Field label="First name" fieldId="crm-contact-first" error={err('firstName')}>
            <TextInput id="crm-contact-first" value={firstName} maxLength={100} onChange={(_e, v) => setFirstName(v)} />
          </Field>
          <Field label="Last name" fieldId="crm-contact-last" error={err('lastName')}>
            <TextInput id="crm-contact-last" value={lastName} maxLength={100} onChange={(_e, v) => setLastName(v)} />
          </Field>
          <Field label="Email" fieldId="crm-contact-email" error={err('email', emailError)}>
            <TextInput
              id="crm-contact-email"
              type="email"
              value={email}
              validated={err('email', emailError) ? 'error' : 'default'}
              onChange={(_e, v) => setEmail(v)}
            />
          </Field>
          <Field label="Job title" fieldId="crm-contact-job" error={err('jobTitle')}>
            <TextInput id="crm-contact-job" value={jobTitle} maxLength={100} onChange={(_e, v) => setJobTitle(v)} />
          </Field>
          <Field label="Company" fieldId="crm-contact-company" error={err('companyId')}>
            <FormSelect id="crm-contact-company" value={companyId} onChange={(_e, v) => setCompanyId(v)}>
              <FormSelectOption value="" label="No company" />
              {companyOptions.map((c) => (
                <FormSelectOption key={c.id} value={c.id} label={c.name} />
              ))}
            </FormSelect>
          </Field>
          <Field label="Owner" fieldId="crm-contact-owner" error={err('ownerId')}>
            <FormSelect id="crm-contact-owner" value={ownerId} onChange={(_e, v) => setOwnerId(v)}>
              <FormSelectOption value="" label="Unassigned" />
              {ownerOptions.map((o) => (
                <FormSelectOption key={o.id} value={o.id} label={o.name} />
              ))}
            </FormSelect>
          </Field>
          <Field label="Source" fieldId="crm-contact-source" error={err('source')}>
            {sources.length > 0 ? (
              <FormSelect id="crm-contact-source" value={source} onChange={(_e, v) => setSource(v)}>
                <FormSelectOption value="" label="No source" />
                {sources.map((s) => (
                  <FormSelectOption key={s.key} value={s.key} label={s.label} />
                ))}
                {source && !sources.some((s) => s.key === source) && <FormSelectOption value={source} label={source} />}
              </FormSelect>
            ) : (
              <TextInput id="crm-contact-source" value={source} maxLength={64} onChange={(_e, v) => setSource(v)} />
            )}
          </Field>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="crm-contact-form" isDisabled={action.busy} isLoading={action.busy}>
          Save contact
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
