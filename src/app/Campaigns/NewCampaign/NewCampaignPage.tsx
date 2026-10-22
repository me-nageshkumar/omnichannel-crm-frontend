import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Wizard, WizardStep, WizardStepType } from '@patternfly/react-core';
import { listSenders } from '@app/api/campaigns';
import { listAttributes } from '@app/api/contacts';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { distinctPlaceholders, mergeMappings } from '@app/Campaigns/mapping';
import { AudienceStep } from '@app/Campaigns/NewCampaign/AudienceStep';
import {
  Draft,
  DraftPatch,
  EMPTY_DRAFT,
  audienceReady,
  mappingContext,
  messageReady,
} from '@app/Campaigns/NewCampaign/draft';
import { MessageStep } from '@app/Campaigns/NewCampaign/MessageStep';
import { ReviewFooter, ReviewStep, useCreateCampaign } from '@app/Campaigns/NewCampaign/ReviewStep';
import { SendersStep } from '@app/Campaigns/NewCampaign/SendersStep';
import { NotFound } from '@app/NotFound/NotFound';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

/** A change to any of these can make a placeholder's source invalid or give it a new default. */
const MAPPING_INPUTS: (keyof Draft)[] = ['kind', 'preview', 'phoneColumn', 'nameColumn', 'templates'];

const NewCampaignWizard: React.FunctionComponent<{ ws: string }> = ({ ws }) => {
  const navigate = useNavigate();
  const attributesLoad = useLoad((tk) => listAttributes(tk, ws), [ws]);
  const attributes = React.useMemo(() => attributesLoad.data ?? [], [attributesLoad.data]);
  const sendersLoad = useLoad((tk) => listSenders(tk, ws), [ws]);
  const senders = React.useMemo(
    () => sendersLoad.data?.filter((s) => s.state !== 'SUSPENDED' && s.state !== 'RETIRED'),
    [sendersLoad.data],
  );
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  // The steps the user has moved away from; one of them that is no longer ready is marked in the nav.
  const [left, setLeft] = React.useState<ReadonlySet<string | number>>(new Set());
  const create = useCreateCampaign(draft);
  const { reset } = create;

  // A create error describes the draft it was sent with; any change makes it stale.
  React.useEffect(() => reset(), [draft, reset]);

  const update = React.useCallback(
    (change: DraftPatch) =>
      setDraft((d) => {
        const patch = typeof change === 'function' ? change(d) : change;
        if (!patch) return d;
        const next = { ...d, ...patch };
        if (!MAPPING_INPUTS.some((k) => k in patch)) return next;
        // A CSV being read has no columns yet; the mappings wait for them rather than lose their column choices.
        if (next.kind === 'CSV' && next.reading) return next;
        const ctx = mappingContext(next, attributes);
        return { ...next, mappings: mergeMappings(next.mappings, distinctPlaceholders(next.templates), ctx) };
      }),
    [attributes],
  );

  // Once every step has been visited the nav reaches Review from anywhere, so Review checks the steps again.
  const stepReady = {
    audience: audienceReady(draft),
    message: messageReady(draft),
    senders: draft.senderIds.length > 0,
  };
  const ready = stepReady.audience && stepReady.message && stepReady.senders;
  const status = (id: keyof typeof stepReady) => (left.has(id) && !stepReady[id] ? 'error' : 'default');
  const onStepChange = (_e: unknown, _current: WizardStepType, prev: WizardStepType) =>
    setLeft((s) => (s.has(prev.id) ? s : new Set(s).add(prev.id)));

  return (
    <>
      {attributesLoad.error && <Alert variant="danger" isInline title={attributesLoad.error} />}
      <Wizard isVisitRequired onStepChange={onStepChange} onClose={() => navigate('/campaigns')}>
        <WizardStep
          name="Audience"
          id="audience"
          status={status('audience')}
          footer={{ isNextDisabled: !stepReady.audience }}
        >
          <AudienceStep draft={draft} update={update} />
        </WizardStep>
        <WizardStep
          name="Message"
          id="message"
          status={status('message')}
          footer={{ isNextDisabled: !stepReady.message }}
        >
          <MessageStep draft={draft} update={update} attributes={attributes} />
        </WizardStep>
        <WizardStep
          name="Senders"
          id="senders"
          status={status('senders')}
          footer={{ isNextDisabled: !stepReady.senders }}
        >
          <SendersStep draft={draft} update={update} senders={senders} error={sendersLoad.error} />
        </WizardStep>
        <WizardStep
          name="Review"
          id="review"
          footer={<ReviewFooter busy={create.busy} ready={ready} onSubmit={(start) => void create.submit(start)} />}
        >
          <ReviewStep draft={draft} attributes={attributes} senders={senders ?? []} create={create} ready={ready} />
        </WizardStep>
      </Wizard>
    </>
  );
};

export const NewCampaignPage: React.FunctionComponent = () => {
  const allowed = useAccess().hasInWorkspace('campaign:manage');
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  if (!allowed) return <NotFound />;
  return (
    <PageShell title="New campaign">
      {/* A draft belongs to one brand; switching brands starts over. */}
      <NewCampaignWizard key={ws} ws={ws} />
    </PageShell>
  );
};
