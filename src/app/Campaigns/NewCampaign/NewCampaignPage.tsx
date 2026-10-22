import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Wizard, WizardStep } from '@patternfly/react-core';
import { listAttributes } from '@app/api/contacts';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { distinctPlaceholders, mergeMappings } from '@app/Campaigns/mapping';
import { AudienceStep } from '@app/Campaigns/NewCampaign/AudienceStep';
import { Draft, EMPTY_DRAFT, audienceReady, mappingContext, messageReady } from '@app/Campaigns/NewCampaign/draft';
import { MessageStep } from '@app/Campaigns/NewCampaign/MessageStep';
import { NotFound } from '@app/NotFound/NotFound';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

/** A change to any of these can make a placeholder's source invalid or give it a new default. */
const MAPPING_INPUTS: (keyof Draft)[] = ['kind', 'preview', 'phoneColumn', 'nameColumn', 'templates'];

const NewCampaignWizard: React.FunctionComponent<{ ws: string }> = ({ ws }) => {
  const navigate = useNavigate();
  const attributesLoad = useLoad((tk) => listAttributes(tk, ws), [ws]);
  const attributes = React.useMemo(() => attributesLoad.data ?? [], [attributesLoad.data]);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);

  const update = React.useCallback(
    (patch: Partial<Draft>) =>
      setDraft((d) => {
        const next = { ...d, ...patch };
        if (!MAPPING_INPUTS.some((k) => k in patch)) return next;
        const ctx = mappingContext(next, attributes);
        return { ...next, mappings: mergeMappings(next.mappings, distinctPlaceholders(next.templates), ctx) };
      }),
    [attributes],
  );

  return (
    <>
      {attributesLoad.error && <Alert variant="danger" isInline title={attributesLoad.error} />}
      <Wizard isVisitRequired onClose={() => navigate('/campaigns')}>
        <WizardStep name="Audience" id="audience" footer={{ isNextDisabled: !audienceReady(draft) }}>
          <AudienceStep draft={draft} update={update} />
        </WizardStep>
        <WizardStep name="Message" id="message" footer={{ isNextDisabled: !messageReady(draft) }}>
          <MessageStep draft={draft} update={update} attributes={attributes} />
        </WizardStep>
        <WizardStep name="Senders" id="senders" />
        <WizardStep name="Review" id="review" />
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
