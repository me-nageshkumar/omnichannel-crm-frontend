import * as React from 'react';
import {
  Alert,
  Content,
  FileUpload,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Radio,
  Spinner,
  Stack,
  Title,
} from '@patternfly/react-core';
import type { ContactAttribute } from '@app/api/contacts';
import { uploadCloudMedia } from '@app/api/cloudMessages';
import { type CloudTemplate, listCloudTemplates } from '@app/api/cloudTemplates';
import { useLoad } from '@app/admin/useLoad';
import { previewValues } from '@app/Campaigns/mapping';
import {
  type StepProps,
  cloudMessageProblem,
  cloudPlaceholders,
  mappingContext,
} from '@app/Campaigns/NewCampaign/draft';
import { PlaceholderMapping } from '@app/Campaigns/NewCampaign/PlaceholderMapping';
import { CloudTemplatePreview } from '@app/CloudTemplates/CloudTemplatePreview';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

/** Why a WhatsApp template cannot be chosen, or null. */
export function unavailableReason(t: CloudTemplate): string | null {
  if (!t.supported) return t.unsupportedReason ?? 'Not supported yet';
  if (t.status === 'PENDING') return "Waiting for Meta's approval";
  if (!t.sendable) return `Not approved (${t.status.toLowerCase()})`;
  return null;
}

const MEDIA = ['IMAGE', 'VIDEO', 'DOCUMENT'] as const;
type MediaFormat = (typeof MEDIA)[number];

/** A Cloud campaign sends one approved WhatsApp template; its blanks are mapped as placeholders. */
export const CloudMessageStep: React.FunctionComponent<StepProps & { attributes: ContactAttribute[] }> = ({
  draft,
  update,
  attributes,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const numberId = draft.senderIds[0] ?? '';
  const list = useLoad((tk) => listCloudTemplates(tk, ws, { phoneNumberId: numberId }), [ws, numberId]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const chosen = draft.cloudTemplate;
  const placeholders = cloudPlaceholders(chosen);
  const format = chosen?.header.format;
  const media = format && (MEDIA as readonly string[]).includes(format) ? (format as MediaFormat) : null;
  const problem = chosen ? cloudMessageProblem(draft) : null;

  // another template's blanks mean other things even under the same key: its mappings start over
  const choose = (t: CloudTemplate) =>
    update((d) =>
      d.cloudTemplate?.id === t.id
        ? null
        : { cloudTemplate: t, mappings: {}, headerMediaId: null, headerFileName: null },
    );

  const upload = async (file: File) => {
    if (!token || !media) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await uploadCloudMedia(
        token,
        ws,
        numberId,
        media.toLowerCase() as 'image' | 'video' | 'document',
        file,
        'whatsapp',
      );
      update({ headerMediaId: res.id, headerFileName: file.name });
    } catch (e) {
      setUploadError(messageFor(e));
    } finally {
      setUploading(false);
    }
  };

  const row = draft.preview
    ? Object.fromEntries(draft.preview.headers.map((h, i) => [h, draft.preview?.sample[0]?.[i] ?? '']))
    : undefined;
  const values = previewValues(placeholders, draft.mappings, { row });

  return (
    <Grid hasGutter>
      <GridItem md={7}>
        <Stack hasGutter>
          {list.error && <Alert variant="danger" isInline title={list.error} />}
          <Title headingLevel="h2" size="md">
            WhatsApp template
          </Title>
          {!list.data ? (
            !list.error && <Spinner aria-label="Loading WhatsApp templates" />
          ) : list.data.length === 0 ? (
            <Content component="p">No WhatsApp templates yet. Sync them on WhatsApp templates.</Content>
          ) : (
            list.data.map((t) => {
              const reason = unavailableReason(t);
              return (
                <Radio
                  key={t.id}
                  id={`cloud-template-${t.id}`}
                  name="cloud-template"
                  label={`${t.name} (${t.language})`}
                  description={reason ?? t.category ?? undefined}
                  isChecked={chosen?.id === t.id}
                  isDisabled={reason !== null}
                  onChange={() => choose(t)}
                />
              );
            })
          )}
          {chosen && media && (
            <Stack hasGutter>
              <FileUpload
                id="cloud-header-file"
                filename={draft.headerFileName ?? ''}
                filenamePlaceholder={`Choose the header ${media.toLowerCase()}`}
                browseButtonText="Upload"
                hideDefaultPreview
                isLoading={uploading}
                onFileInputChange={(_e, file) => void upload(file)}
                onClearClick={() => update({ headerMediaId: null, headerFileName: null })}
              />
              {draft.headerFileName && <Content component="p">{draft.headerFileName}</Content>}
              {uploadError && <Alert variant="danger" isInline title={uploadError} />}
            </Stack>
          )}
          {chosen && (
            <PlaceholderMapping
              placeholders={placeholders}
              mappings={draft.mappings}
              ctx={mappingContext(draft, attributes)}
              onChange={(mappings) => update({ mappings })}
            />
          )}
          {problem && (
            <HelperText>
              <HelperTextItem variant="warning">{problem}</HelperTextItem>
            </HelperText>
          )}
        </Stack>
      </GridItem>
      {chosen && (
        <GridItem md={5}>
          <Stack hasGutter>
            <Title headingLevel="h2" size="md">
              Preview
            </Title>
            <CloudTemplatePreview template={chosen} values={values} />
          </Stack>
        </GridItem>
      )}
    </Grid>
  );
};
