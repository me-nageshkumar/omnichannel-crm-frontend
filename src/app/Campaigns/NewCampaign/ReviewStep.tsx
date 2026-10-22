import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Spinner,
  Stack,
  WizardFooterWrapper,
  useWizardContext,
} from '@patternfly/react-core';
import { SenderView, campaignAction, createCampaign } from '@app/api/campaigns';
import { ApiError } from '@app/api/client';
import { ContactAttribute, countContacts } from '@app/api/contacts';
import { campaignActionMessage } from '@app/api/messages';
import { shown } from '@app/api/phoneNumbers';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { estimateText } from '@app/Campaigns/campaignDisplay';
import { distinctPlaceholders, encodeSource, sourceOptions } from '@app/Campaigns/mapping';
import { Draft, audienceSize, mappingContext, toRequest } from '@app/Campaigns/NewCampaign/draft';
import { capPerDay } from '@app/Campaigns/NewCampaign/SendersStep';
import { countText } from '@app/Contacts/filterSpec';
import { useSession } from '@app/session/SessionContext';

/** The request fields the Review summarises; an error on any of them is shown beside its line. */
const SHOWN_FIELDS = ['name', 'templateIds', 'placeholders', 'senderIds'];

export interface CreateCampaign {
  /** Creates the draft, starts it when {@code start}, and opens it; a second call while one runs is ignored. */
  submit(start: boolean): Promise<void>;
  busy: boolean;
  /** The create failure that names no shown field. */
  error: string | null;
  /** The field the create failure named, if the server gave one. */
  errorField: string | null;
  fieldErrors: Record<string, string>;
  reset(): void;
}

export function useCreateCampaign(draft: Draft): CreateCampaign {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  const create = useAction(SHOWN_FIELDS);
  const [busy, setBusy] = React.useState(false);
  const [errorField, setErrorField] = React.useState<string | null>(null);
  const inFlight = React.useRef(false);
  const { reset: resetCreate } = create;

  const submit = async (start: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErrorField(null);
    const tk = token as string;
    const req = toRequest(draft, distinctPlaceholders(draft.templates));
    const file = draft.kind === 'CSV' ? (draft.file ?? undefined) : undefined;
    const created = await create.run(() =>
      createCampaign(tk, ws, req, file).catch((e: unknown) => {
        setErrorField(e instanceof ApiError ? (e.field ?? null) : null);
        throw e;
      }),
    );
    if (!created) {
      inFlight.current = false;
      setBusy(false);
      return;
    }
    const to = `/campaigns/${created.id}`;
    if (!start) {
      navigate(to);
      return;
    }
    try {
      await campaignAction(tk, ws, created.id, 'start');
      navigate(to);
    } catch (e) {
      // The draft exists; its page says why it did not start.
      navigate(to, { state: { startError: campaignActionMessage(e, 'start') } });
    }
  };

  const reset = React.useCallback(() => {
    resetCreate();
    setErrorField(null);
  }, [resetCreate]);

  return { submit, busy, error: create.error, errorField, fieldErrors: create.fieldErrors, reset };
}

/** Back, the two ways to finish (only for a draft every earlier step accepts), and Cancel. */
export const ReviewFooter: React.FunctionComponent<{
  busy: boolean;
  ready: boolean;
  onSubmit(start: boolean): void;
}> = ({ busy, ready, onSubmit }) => {
  const { goToPrevStep, close } = useWizardContext();
  return (
    <WizardFooterWrapper>
      <Button variant="secondary" onClick={() => void goToPrevStep()}>
        Back
      </Button>
      <Button variant="secondary" isDisabled={busy || !ready} onClick={() => onSubmit(false)}>
        Save draft
      </Button>
      <Button variant="primary" isDisabled={busy || !ready} onClick={() => onSubmit(true)}>
        Start campaign
      </Button>
      <Button variant="link" onClick={close}>
        Cancel
      </Button>
    </WizardFooterWrapper>
  );
};

/** The saved filter's live size; null for a CSV audience or until counted. */
function useFilterCount(draft: Draft): { count: number | null; error: string | null } {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { kind, filterId } = draft;
  const load = useLoad(
    (tk) => (kind === 'FILTER' ? countContacts(tk, ws, { filterId }) : Promise.resolve(null)),
    [ws, kind, filterId],
  );
  return { count: load.data?.count ?? null, error: load.error };
}

const Errors: React.FunctionComponent<{ messages: (string | null | undefined)[] }> = ({ messages }) => (
  <>
    {messages
      .filter((m): m is string => !!m)
      .map((m) => (
        <Alert key={m} variant="danger" isInline isPlain title={m} />
      ))}
  </>
);

/** Everything the campaign will be created with, and the create's errors beside the line they concern. */
export const ReviewStep: React.FunctionComponent<{
  draft: Draft;
  attributes: ContactAttribute[];
  senders: SenderView[];
  create: CreateCampaign;
  /** False when an earlier step no longer accepts the draft; the footer then cannot submit. */
  ready: boolean;
}> = ({ draft, attributes, senders, create, ready }) => {
  const filterCount = useFilterCount(draft);
  const size = audienceSize(draft, filterCount.count);
  const chosen = senders.filter((s) => draft.senderIds.includes(s.phoneNumberId));
  const perDay = capPerDay(chosen);
  const options = sourceOptions(mappingContext(draft, attributes));
  const placeholders = distinctPlaceholders(draft.templates);
  const { error, errorField, fieldErrors } = create;
  const errorsFor = (field: string) => [fieldErrors[field], errorField === field ? error : null];
  const banner = error && !(errorField && SHOWN_FIELDS.includes(errorField)) ? error : null;

  const audience =
    draft.kind === 'FILTER'
      ? `Saved filter ${draft.filterName}${filterCount.count === null ? '' : ` · ${countText(filterCount.count)}`}`
      : [
          `CSV ${draft.file?.name ?? ''}`,
          `${(draft.preview?.rows ?? 0).toLocaleString('en-US')} rows`,
          draft.phoneColumn && `phone column ${draft.phoneColumn}`,
          draft.nameColumn && `name column ${draft.nameColumn}`,
        ]
          .filter(Boolean)
          .join(' · ');

  const sourceText = (name: string) => {
    const m = draft.mappings[name];
    const s = m?.source ?? null;
    if (s?.kind === 'FIXED') return `Fixed text “${s.text}”`;
    const label = options.find((o) => o.value === encodeSource(s))?.label ?? '—';
    // A fixed text is sent without a fallback; any other source sends the one given.
    return m?.fallback ? `${label} (fallback “${m.fallback}”)` : label;
  };

  const estimate =
    size === null
      ? null
      : estimateText({ remaining: size, perDay, days: perDay > 0 ? Math.ceil(size / perDay) : null, finishBy: null });

  return (
    <Stack hasGutter>
      {!ready && <Alert variant="warning" isInline title="Finish the earlier steps before saving." />}
      {banner && <Alert variant="danger" isInline title={banner} />}
      <DescriptionList isHorizontal>
        <DescriptionListGroup>
          <DescriptionListTerm>Name</DescriptionListTerm>
          <DescriptionListDescription>
            <div>{draft.name.trim()}</div>
            <Errors messages={errorsFor('name')} />
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Audience</DescriptionListTerm>
          <DescriptionListDescription>
            <div>{audience}</div>
            {filterCount.error && <Alert variant="danger" isInline isPlain title={filterCount.error} />}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Templates</DescriptionListTerm>
          <DescriptionListDescription>
            <div>{draft.templates.map((t) => t.name).join(', ')}</div>
            <Errors messages={errorsFor('templateIds')} />
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Placeholders</DescriptionListTerm>
          <DescriptionListDescription>
            {placeholders.length === 0 ? (
              <div>—</div>
            ) : (
              placeholders.map((p) => <div key={p.name}>{`${p.name}: ${sourceText(p.name)}`}</div>)
            )}
            <Errors messages={errorsFor('placeholders')} />
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Senders</DescriptionListTerm>
          <DescriptionListDescription>
            <div>{chosen.map((s) => shown(s.number)).join(', ')}</div>
            <Errors messages={errorsFor('senderIds')} />
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Estimate</DescriptionListTerm>
          <DescriptionListDescription>
            {size === null && !filterCount.error ? (
              <Spinner size="sm" aria-label="Counting contacts" />
            ) : (
              (estimate ?? '—')
            )}
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>
    </Stack>
  );
};
