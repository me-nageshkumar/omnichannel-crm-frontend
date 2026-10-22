import * as React from 'react';
import { Alert, Grid, GridItem, Label, LabelGroup, Stack, StackItem, Title } from '@patternfly/react-core';
import { Contact, ContactAttribute, searchContacts } from '@app/api/contacts';
import type { TemplateView } from '@app/api/templates';
import { distinctPlaceholders, previewValues } from '@app/Campaigns/mapping';
import { Draft, MAX_TEMPLATES, StepProps, hasLink, mappingContext } from '@app/Campaigns/NewCampaign/draft';
import { PlaceholderMapping } from '@app/Campaigns/NewCampaign/PlaceholderMapping';
import { SampleCsvLinks } from '@app/Campaigns/NewCampaign/SampleCsvLinks';
import { useSession } from '@app/session/SessionContext';
import { TemplateBubble } from '@app/Templates/TemplateBubble';
import { TemplateSearchList } from '@app/Templates/TemplateSearchList';
import { fillPreview } from '@app/Templates/placeholders';

const FILTERS = { status: 'ACTIVE', type: 'TEXT' } as const;

/** The first contact of the saved filter, to preview the messages with; undefined until known or when there is none. */
function useSampleContact(draft: Draft): Contact | undefined {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [contact, setContact] = React.useState<Contact | undefined>(undefined);
  const { kind, filterId } = draft;

  React.useEffect(() => {
    setContact(undefined);
    if (kind !== 'FILTER' || !filterId || !token) return undefined;
    let live = true;
    searchContacts(token, ws, { filterId, page: 0 }).then(
      (page) => {
        if (live) setContact(page.items[0]);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [kind, filterId, token, ws]);
  return contact;
}

/** Choose one to five text templates, map their placeholders, and preview what a recipient gets. */
export const MessageStep: React.FunctionComponent<StepProps & { attributes: ContactAttribute[] }> = ({
  draft,
  update,
  attributes,
}) => {
  const [listError, setListError] = React.useState<string | null>(null);
  const contact = useSampleContact(draft);
  const { templates, preview } = draft;
  const ids = templates.map((t) => t.id);
  const placeholders = distinctPlaceholders(templates);
  const csvWithoutFile = draft.kind === 'CSV' && preview === null;

  const unavailable = (t: TemplateView) => {
    if (hasLink(t.content.body)) return 'Contains a link';
    return templates.length >= MAX_TEMPLATES && !ids.includes(t.id) ? 'Five templates chosen' : null;
  };
  const toggle = (t: TemplateView) =>
    update({ templates: ids.includes(t.id) ? templates.filter((x) => x.id !== t.id) : [...templates, t] });

  const row = preview
    ? Object.fromEntries(preview.headers.map((h, i) => [h, preview.sample[0]?.[i] ?? '']))
    : undefined;
  const values = previewValues(placeholders, draft.mappings, { contact, row });

  return (
    <Grid hasGutter>
      <GridItem md={7}>
        <Stack hasGutter>
          {listError && <Alert variant="danger" isInline title={listError} />}
          <StackItem>
            <TemplateSearchList
              filters={FILTERS}
              selectedIds={ids}
              unavailable={unavailable}
              onPick={toggle}
              onError={setListError}
            />
          </StackItem>
          {templates.length > 0 && (
            <StackItem>
              <LabelGroup categoryName="Chosen templates" numLabels={MAX_TEMPLATES}>
                {templates.map((t) => (
                  <Label key={t.id} onClose={() => toggle(t)} closeBtnAriaLabel={`Remove ${t.name}`}>
                    {t.name}
                  </Label>
                ))}
              </LabelGroup>
            </StackItem>
          )}
          {templates.length > 0 && templates.length < 3 && (
            <Alert
              variant="warning"
              isInline
              isPlain
              title="Fewer than three variants makes the fleet's messages look alike"
            />
          )}
          {templates.length > 0 && csvWithoutFile && (
            <StackItem>
              <p>Choose the CSV file in Audience to map its columns.</p>
              <SampleCsvLinks templates={templates} />
            </StackItem>
          )}
          {!csvWithoutFile && (
            <StackItem>
              <PlaceholderMapping
                placeholders={placeholders}
                mappings={draft.mappings}
                ctx={mappingContext(draft, attributes)}
                onChange={(mappings) => update({ mappings })}
              />
            </StackItem>
          )}
        </Stack>
      </GridItem>
      {templates.length > 0 && !csvWithoutFile && (
        <GridItem md={5}>
          <Stack hasGutter>
            <Title headingLevel="h2" size="md">
              Preview
            </Title>
            {templates.map((t) => (
              <TemplateBubble
                key={t.id}
                label={`Preview of ${t.name}`}
                type={t.type}
                content={{ ...t.content, body: fillPreview(t.content.body ?? '', values) }}
                media={t.media}
              />
            ))}
          </Stack>
        </GridItem>
      )}
    </Grid>
  );
};
