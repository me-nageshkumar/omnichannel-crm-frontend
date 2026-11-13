import * as React from 'react';
import {
  Alert,
  ExpandableSection,
  FileUpload,
  Form,
  FormGroup,
  Spinner,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import type { ChatbotMediaType } from '@app/api/chatbots';
import { previewChatbotMessage, uploadChatbotMedia } from '@app/api/chatbots';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { repliesOf } from '@app/Chatbots/nodeCatalog';
import { ErrorLine, useVariables } from '@app/Chatbots/nodes/common';
import { ACCEPT, InteractiveFields, MAX_BYTES, NOUN } from '@app/Chatbots/nodes/InteractiveFields';
import type { MessageDraft, MessageKind } from '@app/Chatbots/nodes/messageDraft';
import { MESSAGE_KINDS, fromCloudMessage, messageProblems, toCloudMessage } from '@app/Chatbots/nodes/messageDraft';
import { useSession } from '@app/session/SessionContext';

const PREVIEW_DEBOUNCE_MS = 400;
const MEDIA_ACCEPT: Record<ChatbotMediaType, Record<string, string[]>> = {
  ...ACCEPT,
  audio: {
    'audio/mpeg': ['.mp3'],
    'audio/ogg': ['.ogg'],
    'audio/aac': ['.aac'],
    'audio/mp4': ['.m4a'],
    'audio/amr': ['.amr'],
  },
};

/** `settings.message.text.body` style server keys, and `message.text.body` publish keys, both land on `text.body`. */
function messageErrors(errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.keys(errors).forEach((k) => {
    const m = /^(?:settings\.)?message\.(.+)$/.exec(k);
    if (m) out[m[1]] = errors[k];
  });
  return out;
}

/**
 * The Send message node's form (spec §8.1): one draft per kind, the Cloud message object stored on the node,
 * and the server's rendering of the message under a collapsed preview.
 */
export const SendMessageFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const vars = useVariables(p);
  // the per-kind drafts live here so switching the kind and back loses nothing; the node stores only the chosen kind
  const [draft, setDraft] = React.useState<MessageDraft>(() =>
    fromCloudMessage(p.settings.message as Record<string, unknown> | undefined),
  );
  const [uploading, setUploading] = React.useState(false);
  const [uploadProblem, setUploadProblem] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [html, setHtml] = React.useState<string | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [rendering, setRendering] = React.useState(false);

  // a change from outside the form (undo, another node selected into the same drawer) replaces the draft
  const saved = JSON.stringify(p.settings.message ?? null);
  const lastEmitted = React.useRef(saved);
  React.useEffect(() => {
    if (saved !== lastEmitted.current) {
      lastEmitted.current = saved;
      setDraft(fromCloudMessage(p.settings.message as Record<string, unknown> | undefined));
    }
  }, [saved, p.settings.message]);

  const emit = (next: MessageDraft) => {
    setDraft(next);
    const message = toCloudMessage(next);
    lastEmitted.current = JSON.stringify(message);
    p.onChange({ ...p.settings, message });
  };

  const problems = React.useMemo(() => messageProblems(draft), [draft]);
  const errors = React.useMemo(() => ({ ...problems, ...messageErrors(p.errors) }), [problems, p.errors]);
  const complete = Object.keys(problems).length === 0;
  const message = React.useMemo(() => toCloudMessage(draft), [draft]);

  React.useEffect(() => {
    if (!previewOpen || !complete) {
      setHtml(null);
      setRendering(false);
      return undefined;
    }
    let live = true;
    setRendering(true);
    const timer = setTimeout(() => {
      previewChatbotMessage(t, ws, p.chatbotId, message).then(
        (h) => {
          if (!live) return;
          setHtml(h);
          setPreviewError(null);
          setRendering(false);
        },
        (e) => {
          if (!live) return;
          setHtml(null);
          setPreviewError(e instanceof Error ? e.message : 'The preview could not be rendered');
          setRendering(false);
        },
      );
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [previewOpen, complete, message, t, ws, p.chatbotId]);

  const upload = (file: File, type: ChatbotMediaType) => uploadChatbotMedia(t, ws, p.chatbotId, type, file);
  const uploadMedia = async (files: File[]) => {
    const file = files[0];
    const kind = draft.kind;
    if (!file || kind === 'text' || kind === 'interactive' || kind === 'location') return;
    setUploadProblem(null);
    setUploading(true);
    try {
      const { id } = await upload(file, kind);
      emit({
        ...draft,
        media: {
          ...draft.media,
          id,
          uploadedName: file.name,
          filename: draft.media.filename || (kind === 'document' ? file.name : ''),
        },
      });
    } catch (e) {
      setUploadProblem(e instanceof Error ? e.message : 'The upload failed');
    } finally {
      setUploading(false);
    }
  };

  const kind = draft.kind;
  const isMedia = kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'document';
  const replies = repliesOf(message);

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="Message kind" fieldId="sm-kind">
        <ToggleGroup aria-label="Message kind" isCompact>
          {MESSAGE_KINDS.map((k) => (
            <ToggleGroupItem
              key={k.value}
              text={k.label}
              buttonId={`sm-kind-${k.value}`}
              isSelected={kind === k.value}
              isDisabled={p.isDisabled}
              onChange={() => emit({ ...draft, kind: k.value as MessageKind })}
            />
          ))}
        </ToggleGroup>
        <ErrorLine message={errors['type']} />
      </FormGroup>

      {kind === 'text' && (
        <FormGroup label="Text" isRequired fieldId="sm-text">
          <VariableInput
            id="sm-text"
            aria-label="Text"
            multiline
            rows={6}
            value={draft.text}
            maxLength={4096}
            onChange={(v) => emit({ ...draft, text: v })}
            variables={vars}
            isDisabled={p.isDisabled}
            validated={errors['text.body'] ? 'error' : 'default'}
          />
          <ErrorLine message={errors['text.body']} />
          <p className="pf-v6-u-color-200">*bold*, _italic_, ~strike~ and ```mono``` work like in WhatsApp.</p>
        </FormGroup>
      )}

      {isMedia && (
        <>
          <FormGroup label="File" isRequired fieldId="sm-file">
            <FileUpload
              id="sm-file"
              filename={draft.media.uploadedName}
              filenamePlaceholder={`Drag ${NOUN[kind]} here, or browse`}
              browseButtonText="Browse"
              hideDefaultPreview
              isLoading={uploading}
              isDisabled={p.isDisabled}
              onClearClick={() => emit({ ...draft, media: { ...draft.media, id: '', uploadedName: '' } })}
              dropzoneProps={{
                accept: MEDIA_ACCEPT[kind],
                maxSize: MAX_BYTES[kind],
                onDropAccepted: (files) => void uploadMedia(files),
                onDropRejected: () =>
                  setUploadProblem(`Choose ${NOUN[kind]} under ${MAX_BYTES[kind] / (1024 * 1024)} MB.`),
              }}
            />
            {uploadProblem && <Alert variant="danger" isInline isPlain title={uploadProblem} />}
            <ErrorLine message={errors[`${kind}.id`]} />
          </FormGroup>
          {kind !== 'audio' && (
            <FormGroup label="Caption" fieldId="sm-caption">
              <VariableInput
                id="sm-caption"
                aria-label="Caption"
                multiline
                rows={3}
                value={draft.media.caption}
                maxLength={1024}
                onChange={(v) => emit({ ...draft, media: { ...draft.media, caption: v } })}
                variables={vars}
                isDisabled={p.isDisabled}
              />
              <ErrorLine message={errors[`${kind}.caption`]} />
            </FormGroup>
          )}
          {kind === 'document' && (
            <FormGroup label="File name shown" fieldId="sm-filename">
              <TextInput
                id="sm-filename"
                aria-label="File name shown"
                value={draft.media.filename}
                isDisabled={p.isDisabled}
                onChange={(_e, v) => emit({ ...draft, media: { ...draft.media, filename: v } })}
              />
              <ErrorLine message={errors['document.filename']} />
            </FormGroup>
          )}
        </>
      )}

      {kind === 'location' && (
        <>
          <div className="omni-form-field__row">
            <FormGroup label="Latitude" isRequired fieldId="sm-lat">
              <TextInput
                id="sm-lat"
                aria-label="Latitude"
                value={draft.location.latitude}
                isDisabled={p.isDisabled}
                validated={errors['location.latitude'] ? 'error' : 'default'}
                onChange={(_e, v) => emit({ ...draft, location: { ...draft.location, latitude: v } })}
              />
              <ErrorLine message={errors['location.latitude']} />
            </FormGroup>
            <FormGroup label="Longitude" isRequired fieldId="sm-lng">
              <TextInput
                id="sm-lng"
                aria-label="Longitude"
                value={draft.location.longitude}
                isDisabled={p.isDisabled}
                validated={errors['location.longitude'] ? 'error' : 'default'}
                onChange={(_e, v) => emit({ ...draft, location: { ...draft.location, longitude: v } })}
              />
              <ErrorLine message={errors['location.longitude']} />
            </FormGroup>
          </div>
          <FormGroup label="Place name" fieldId="sm-loc-name">
            <VariableInput
              id="sm-loc-name"
              aria-label="Place name"
              value={draft.location.name}
              onChange={(v) => emit({ ...draft, location: { ...draft.location, name: v } })}
              variables={vars}
              isDisabled={p.isDisabled}
            />
          </FormGroup>
          <FormGroup label="Address" fieldId="sm-loc-address">
            <VariableInput
              id="sm-loc-address"
              aria-label="Address"
              value={draft.location.address}
              onChange={(v) => emit({ ...draft, location: { ...draft.location, address: v } })}
              variables={vars}
              isDisabled={p.isDisabled}
            />
          </FormGroup>
        </>
      )}

      {kind === 'interactive' && (
        <>
          <InteractiveFields
            draft={draft.interactive}
            onChange={(next) => emit({ ...draft, interactive: next })}
            errors={errors}
            isDisabled={p.isDisabled}
            variables={vars}
            upload={upload}
          />
          <p className="pf-v6-u-color-200">
            {replies.length > 0 ? `Replies: ${replies.map((r) => r.title).join(', ')}, Other` : 'Replies: Other'}
          </p>
        </>
      )}

      <ExpandableSection
        toggleText={previewOpen ? 'Hide preview' : 'Show preview'}
        isExpanded={previewOpen}
        onToggle={(_e, open) => setPreviewOpen(open)}
      >
        <div className="omni-message-preview">
          {html ? (
            <iframe title="Preview" sandbox="" srcDoc={html} />
          ) : rendering ? (
            <Spinner size="lg" aria-label="Rendering the preview" />
          ) : previewError ? (
            <Alert variant="danger" isInline isPlain title={previewError} />
          ) : (
            <span className="pf-v6-u-color-200">
              {complete ? 'Rendering…' : 'Fill in the message to see how it will look'}
            </span>
          )}
        </div>
      </ExpandableSection>
    </Form>
  );
};
