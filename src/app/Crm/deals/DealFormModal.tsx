import * as React from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { createDeal, updateDeal } from '@app/api/crm';
import type { CrmSettings, Deal, DealInput, Pipeline, Ref } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { CompanyTypeahead } from '@app/Crm/Companies/CompanyTypeahead';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';
import { ContactPicker } from '@app/Crm/deals/ContactPicker';
import { Field } from '@app/Crm/deals/fields';
import { isCode } from '@app/Crm/Settings/ConflictAlert';

const CURRENCY = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = [
  'title',
  'primaryCrmContactId',
  'amount',
  'currency',
  'expectedCloseDate',
  'companyId',
  'ownerId',
  'source',
  'stageId',
];

/** Adds the options for {@code extra} that the list lacks (an existing value no longer offered). */
const withValue = (list: Ref[], extra: Ref | null | undefined): Ref[] =>
  extra && !list.some((r) => r.id === extra.id) ? [...list, extra] : list;

/**
 * Creates a deal in {@code pipeline}, or (with {@code deal}) edits one. An edit never changes the primary contact,
 * pipeline or stage; stages change through a move.
 */
export const DealFormModal: React.FunctionComponent<{
  deal?: Deal;
  pipeline: Pipeline;
  settings: CrmSettings;
  /** People who may own the deal besides the user (e.g. the owners seen on the board). */
  owners?: Ref[];
  onSaved(deal: Deal): void;
  onClose(): void;
}> = ({ deal, pipeline, settings, owners = [], onSaved, onClose }) => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const isEdit = !!deal;
  const openStages = pipeline.stages.filter((s) => s.type === 'OPEN');
  const sources = settings.dealSources.filter((s) => s.active).sort((a, b) => a.position - b.position);

  const [title, setTitle] = React.useState(deal?.title ?? '');
  const [contactId, setContactId] = React.useState(deal?.primaryContact?.id ?? '');
  const [company, setCompany] = React.useState<Ref | null>(deal?.company ?? null);
  const canCreateCompany = useCrmCan('crm:edit');
  const [amount, setAmount] = React.useState(deal?.amount == null ? '' : String(deal.amount));
  const [currency, setCurrency] = React.useState(deal?.currency || settings.defaultCurrency);
  const [stageId, setStageId] = React.useState(openStages[0]?.id ?? '');
  const [close, setClose] = React.useState(deal?.expectedCloseDate ?? '');
  const [ownerId, setOwnerId] = React.useState(isEdit ? (deal?.owner?.id ?? '') : (user?.id ?? ''));
  const [source, setSource] = React.useState(deal?.source ?? '');
  const [checked, setChecked] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const action = useAction(FIELDS);

  const me: Ref | null = user ? { id: user.id, name: `${user.name} (you)` } : null;
  const ownerOptions = withValue(
    withValue(
      owners.filter((o) => o.id !== me?.id),
      deal?.owner && deal.owner.id !== me?.id ? deal.owner : null,
    ),
    me,
  ).sort((a, b) => a.name.localeCompare(b.name));

  const amountOk = amount.trim() === '' || (Number.isFinite(Number(amount)) && Number(amount) >= 0);
  const errors = {
    title: checked && !title.trim() ? 'Give the deal a title.' : null,
    contact: checked && !isEdit && !contactId ? 'Choose the contact this deal is with.' : null,
    amount: checked && !amountOk ? 'Enter an amount of zero or more.' : null,
    currency: checked && !CURRENCY.test(currency) ? 'Three letters, for example INR or USD.' : null,
    close: checked && close !== '' && !ISO_DATE.test(close) ? 'Use the format yyyy-mm-dd.' : null,
  };
  const shown = (key: string, own: string | null) => own ?? action.fieldErrors[key] ?? null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    setConflict(false);
    if (!title.trim() || (!isEdit && !contactId) || !amountOk || !CURRENCY.test(currency)) return;
    if (close !== '' && !ISO_DATE.test(close)) return;
    const number = amount.trim() === '' ? undefined : Number(amount);
    const t = token as string;
    const result = await action.run(
      () => {
        if (deal) {
          // A blank string clears a field on the server; absent leaves it as it is.
          const body: DealInput = {
            title: title.trim(),
            amount: number,
            currency,
            expectedCloseDate: close,
            companyId: company?.id ?? '',
            ownerId,
            source,
            version: deal.version,
          };
          return updateDeal(t, ws, deal.id, body);
        }
        const body: DealInput = {
          title: title.trim(),
          pipelineId: pipeline.id,
          stageId: stageId || undefined,
          primaryCrmContactId: contactId,
          crmContactIds: [contactId],
          amount: number,
          currency,
          expectedCloseDate: close || undefined,
          companyId: company?.id,
          ownerId: ownerId || undefined,
          source: source || undefined,
        };
        return createDeal(t, ws, body);
      },
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          setConflict(true);
          return '';
        }
        return (e as { serverMessage?: string }).serverMessage ?? 'Could not save the deal. Try again.';
      },
    );
    if (result) onSaved(result);
  };

  const err = shown;
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="crm-deal-title">
      <ModalHeader title={isEdit ? 'Edit deal' : 'New deal'} labelId="crm-deal-title" />
      <ModalBody>
        {conflict && (
          <Alert
            variant="warning"
            isInline
            isPlain
            title="Someone else changed this deal. Close this form and open the deal again to see their changes."
          />
        )}
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="crm-deal-form" onSubmit={onSubmit}>
          <Field label="Title" fieldId="crm-deal-name" isRequired error={err('title', errors.title)}>
            <TextInput
              id="crm-deal-name"
              value={title}
              maxLength={200}
              validated={err('title', errors.title) ? 'error' : 'default'}
              onChange={(_e, v) => setTitle(v)}
            />
          </Field>
          <Field
            label="Primary contact"
            fieldId="crm-deal-contact"
            isRequired={!isEdit}
            error={err('primaryCrmContactId', errors.contact)}
            help={
              isEdit
                ? "The deal stays on its primary contact's number."
                : "The deal uses this contact's WhatsApp number."
            }
          >
            <ContactPicker
              id="crm-deal-contact"
              value={contactId}
              selectedLabel={deal?.primaryContact?.name || deal?.primaryContact?.phone || undefined}
              isDisabled={isEdit}
              invalid={!!err('primaryCrmContactId', errors.contact)}
              onChange={setContactId}
            />
          </Field>
          <Field label="Company" fieldId="crm-deal-company" error={action.fieldErrors.companyId}>
            <CompanyTypeahead
              id="crm-deal-company"
              value={company}
              onChange={setCompany}
              canCreate={canCreateCompany}
            />
          </Field>
          <Field label="Amount" fieldId="crm-deal-amount" error={err('amount', errors.amount)}>
            <TextInput
              id="crm-deal-amount"
              type="number"
              min={0}
              value={amount}
              validated={err('amount', errors.amount) ? 'error' : 'default'}
              onChange={(_e, v) => setAmount(v)}
            />
          </Field>
          <Field label="Currency" fieldId="crm-deal-currency" error={err('currency', errors.currency)}>
            <TextInput
              id="crm-deal-currency"
              value={currency}
              maxLength={3}
              validated={err('currency', errors.currency) ? 'error' : 'default'}
              onChange={(_e, v) => setCurrency(v.toUpperCase())}
            />
          </Field>
          {!isEdit && openStages.length > 0 && (
            <Field label="Stage" fieldId="crm-deal-stage" error={action.fieldErrors.stageId}>
              <FormSelect id="crm-deal-stage" value={stageId} onChange={(_e, v) => setStageId(v)}>
                {openStages.map((s) => (
                  <FormSelectOption key={s.id} value={s.id} label={s.name} />
                ))}
              </FormSelect>
            </Field>
          )}
          <Field label="Expected close" fieldId="crm-deal-close" error={err('expectedCloseDate', errors.close)}>
            <DatePicker
              id="crm-deal-close"
              value={close}
              aria-label="Expected close"
              onChange={(_e, value) => setClose(value)}
            />
          </Field>
          <Field label="Owner" fieldId="crm-deal-owner" error={action.fieldErrors.ownerId}>
            <FormSelect id="crm-deal-owner" value={ownerId} onChange={(_e, v) => setOwnerId(v)}>
              <FormSelectOption value="" label="Unassigned" />
              {ownerOptions.map((o) => (
                <FormSelectOption key={o.id} value={o.id} label={o.name} />
              ))}
            </FormSelect>
          </Field>
          <Field label="Source" fieldId="crm-deal-source" error={action.fieldErrors.source}>
            {sources.length > 0 ? (
              <FormSelect id="crm-deal-source" value={source} onChange={(_e, v) => setSource(v)}>
                <FormSelectOption value="" label="No source" />
                {sources.map((s) => (
                  <FormSelectOption key={s.key} value={s.key} label={s.label} />
                ))}
                {source && !sources.some((s) => s.key === source) && <FormSelectOption value={source} label={source} />}
              </FormSelect>
            ) : (
              <TextInput id="crm-deal-source" value={source} maxLength={64} onChange={(_e, v) => setSource(v)} />
            )}
          </Field>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="crm-deal-form" isDisabled={action.busy} isLoading={action.busy}>
          {isEdit ? 'Save deal' : 'Create deal'}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
