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
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { createCompany, updateCompany } from '@app/api/crm';
import type { Address, Company, CompanyInput, CrmSettings, Ref } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';
import { isCode } from '@app/Crm/Settings/ConflictAlert';

const FIELDS = [
  'name',
  'domain',
  'website',
  'industry',
  'size',
  'annualRevenue',
  'phone',
  'email',
  'address',
  'description',
  'ownerId',
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const withValue = (list: Ref[], extra: Ref | null | undefined): Ref[] =>
  extra && !list.some((r) => r.id === extra.id) ? [...list, extra] : list;

/** Creates a company, or (with {@code company}) edits one; on an edit a blank value clears the field. */
export const CompanyFormModal: React.FunctionComponent<{
  company?: Company;
  settings?: CrmSettings;
  owners?: Ref[];
  onSaved(company: Company): void;
  /** The server refused the save because the company changed meanwhile; the caller fetches the fresh one. */
  onConflict?(): void;
  onClose(): void;
}> = ({ company, settings, owners = [], onSaved, onConflict, onClose }) => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const isEdit = !!company;
  // The version the fields were seeded from: a refetch while the form is open must not make stale fields look current.
  const [version] = React.useState(company?.version);
  const industries = (settings?.industries ?? []).filter((i) => i.active).sort((a, b) => a.position - b.position);

  const [name, setName] = React.useState(company?.name ?? '');
  const [domain, setDomain] = React.useState(company?.domain ?? '');
  const [website, setWebsite] = React.useState(company?.website ?? '');
  const [industry, setIndustry] = React.useState(company?.industry ?? '');
  const [size, setSize] = React.useState(company?.size ?? '');
  const [revenue, setRevenue] = React.useState(company?.annualRevenue == null ? '' : String(company.annualRevenue));
  const [phone, setPhone] = React.useState(company?.phone ?? '');
  const [email, setEmail] = React.useState(company?.email ?? '');
  const [address, setAddress] = React.useState<Record<keyof Address, string>>({
    line1: company?.address?.line1 ?? '',
    city: company?.address?.city ?? '',
    state: company?.address?.state ?? '',
    postalCode: company?.address?.postalCode ?? '',
    country: company?.address?.country ?? '',
  });
  const [description, setDescription] = React.useState(company?.description ?? '');
  const [ownerId, setOwnerId] = React.useState(isEdit ? (company?.owner?.id ?? '') : (user?.id ?? ''));
  const [checked, setChecked] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const action = useAction(FIELDS);

  const me: Ref | null = user ? { id: user.id, name: `${user.name} (you)` } : null;
  const ownerOptions = withValue(
    withValue(
      owners.filter((o) => o.id !== me?.id),
      company?.owner && company.owner.id !== me?.id ? company.owner : null,
    ),
    me,
  ).sort((a, b) => a.name.localeCompare(b.name));

  const revenueOk = revenue.trim() === '' || (Number.isFinite(Number(revenue)) && Number(revenue) >= 0);
  const emailOk = email.trim() === '' || EMAIL.test(email.trim());
  const errors = {
    name: checked && !name.trim() ? 'Give the company a name.' : null,
    annualRevenue: checked && !revenueOk ? 'Enter an amount of zero or more.' : null,
    email: checked && !emailOk ? 'Enter a valid email address.' : null,
  };
  const err = (key: keyof typeof errors) => errors[key] ?? action.fieldErrors[key] ?? null;
  const setPart = (key: keyof Address) => (_e: unknown, v: string) => setAddress((a) => ({ ...a, [key]: v }));

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    setConflict(false);
    if (!name.trim() || !revenueOk || !emailOk) return;
    const trimmed = (v: string) => v.trim();
    const parts = Object.fromEntries(
      (Object.keys(address) as (keyof Address)[]).map((k) => [k, trimmed(address[k])]),
    ) as Record<keyof Address, string>;
    const hasAddress = Object.values(parts).some((v) => v !== '');
    const revenueValue = revenue.trim() === '' ? null : Number(revenue);
    const t = token as string;
    const saved = await action.run(
      () => {
        if (company) {
          const body: CompanyInput = {
            name: trimmed(name),
            domain: trimmed(domain),
            website: trimmed(website),
            industry,
            size: trimmed(size),
            annualRevenue: revenueValue,
            phone: trimmed(phone),
            email: trimmed(email),
            address: parts,
            description: trimmed(description),
            ownerId,
            version,
          };
          return updateCompany(t, ws, company.id, body);
        }
        const body: CompanyInput = { name: trimmed(name) };
        if (trimmed(domain)) body.domain = trimmed(domain);
        if (trimmed(website)) body.website = trimmed(website);
        if (industry) body.industry = industry;
        if (trimmed(size)) body.size = trimmed(size);
        if (revenueValue !== null) body.annualRevenue = revenueValue;
        if (trimmed(phone)) body.phone = trimmed(phone);
        if (trimmed(email)) body.email = trimmed(email);
        if (hasAddress) body.address = Object.fromEntries(Object.entries(parts).filter(([, v]) => v !== ''));
        if (trimmed(description)) body.description = trimmed(description);
        if (ownerId) body.ownerId = ownerId;
        return createCompany(t, ws, body);
      },
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          setConflict(true);
          onConflict?.();
          return '';
        }
        return (e as { serverMessage?: string }).serverMessage ?? 'Could not save the company. Try again.';
      },
    );
    if (saved) onSaved(saved);
  };

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="crm-company-title">
      <ModalHeader title={isEdit ? 'Edit company' : 'New company'} labelId="crm-company-title" />
      <ModalBody>
        {conflict && (
          <Alert
            variant="warning"
            isInline
            isPlain
            title="Someone else changed this company. Close this form and open the company again to see their changes."
          />
        )}
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="crm-company-form" onSubmit={onSubmit}>
          <Field label="Name" fieldId="crm-company-name" isRequired error={err('name')}>
            <TextInput
              id="crm-company-name"
              value={name}
              maxLength={200}
              validated={err('name') ? 'error' : 'default'}
              onChange={(_e, v) => setName(v)}
            />
          </Field>
          <Field label="Domain" fieldId="crm-company-domain" error={action.fieldErrors.domain}>
            <TextInput id="crm-company-domain" value={domain} onChange={(_e, v) => setDomain(v)} />
          </Field>
          <Field label="Website" fieldId="crm-company-website" error={action.fieldErrors.website}>
            <TextInput id="crm-company-website" value={website} onChange={(_e, v) => setWebsite(v)} />
          </Field>
          <Field label="Industry" fieldId="crm-company-industry" error={action.fieldErrors.industry}>
            <FormSelect id="crm-company-industry" value={industry} onChange={(_e, v) => setIndustry(v)}>
              <FormSelectOption value="" label="No industry" />
              {industries.map((i) => (
                <FormSelectOption key={i.key} value={i.key} label={i.label} />
              ))}
              {industry && !industries.some((i) => i.key === industry) && (
                <FormSelectOption
                  value={industry}
                  label={settings?.industries.find((i) => i.key === industry)?.label ?? industry}
                />
              )}
            </FormSelect>
          </Field>
          <Field label="Size" fieldId="crm-company-size" error={action.fieldErrors.size}>
            <TextInput id="crm-company-size" value={size} onChange={(_e, v) => setSize(v)} />
          </Field>
          <Field label="Annual revenue" fieldId="crm-company-revenue" error={err('annualRevenue')}>
            <TextInput
              id="crm-company-revenue"
              type="number"
              min={0}
              value={revenue}
              validated={err('annualRevenue') ? 'error' : 'default'}
              onChange={(_e, v) => setRevenue(v)}
            />
          </Field>
          <Field label="Phone" fieldId="crm-company-phone" error={action.fieldErrors.phone}>
            <TextInput id="crm-company-phone" value={phone} onChange={(_e, v) => setPhone(v)} />
          </Field>
          <Field label="Email" fieldId="crm-company-email" error={err('email')}>
            <TextInput
              id="crm-company-email"
              type="email"
              value={email}
              validated={err('email') ? 'error' : 'default'}
              onChange={(_e, v) => setEmail(v)}
            />
          </Field>
          <Field label="Address line" fieldId="crm-company-line1" error={action.fieldErrors.address}>
            <TextInput id="crm-company-line1" value={address.line1} onChange={setPart('line1')} />
          </Field>
          <Field label="City" fieldId="crm-company-city">
            <TextInput id="crm-company-city" value={address.city} onChange={setPart('city')} />
          </Field>
          <Field label="State" fieldId="crm-company-state">
            <TextInput id="crm-company-state" value={address.state} onChange={setPart('state')} />
          </Field>
          <Field label="Postal code" fieldId="crm-company-postal">
            <TextInput id="crm-company-postal" value={address.postalCode} onChange={setPart('postalCode')} />
          </Field>
          <Field label="Country" fieldId="crm-company-country">
            <TextInput id="crm-company-country" value={address.country} onChange={setPart('country')} />
          </Field>
          <Field label="Description" fieldId="crm-company-description" error={action.fieldErrors.description}>
            <TextArea
              id="crm-company-description"
              value={description}
              resizeOrientation="vertical"
              onChange={(_e, v) => setDescription(v)}
            />
          </Field>
          <Field label="Owner" fieldId="crm-company-owner" error={action.fieldErrors.ownerId}>
            <FormSelect id="crm-company-owner" value={ownerId} onChange={(_e, v) => setOwnerId(v)}>
              <FormSelectOption value="" label="Unassigned" />
              {ownerOptions.map((o) => (
                <FormSelectOption key={o.id} value={o.id} label={o.name} />
              ))}
            </FormSelect>
          </Field>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="crm-company-form" isDisabled={action.busy} isLoading={action.busy}>
          {isEdit ? 'Save company' : 'Create company'}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
