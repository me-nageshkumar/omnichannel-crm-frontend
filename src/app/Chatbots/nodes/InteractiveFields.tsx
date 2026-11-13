import * as React from 'react';
import { Alert, Button, FileUpload, FormGroup, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import type { ChatbotMediaType } from '@app/api/chatbots';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { ErrorLine } from '@app/Chatbots/nodes/common';
import type { VariableGroup } from '@app/Chatbots/variables';
import type { Draft, HeaderDraft } from '@app/Inbox/interactiveModel';
import { KINDS, LIMITS, keyFor, withTitle } from '@app/Inbox/interactiveModel';

export const ACCEPT: Record<Exclude<ChatbotMediaType, 'audio'>, Record<string, string[]>> = {
  image: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
  video: { 'video/mp4': ['.mp4'], 'video/3gpp': ['.3gp'] },
  document: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/zip': ['.zip'],
  },
};
export const MAX_BYTES: Record<ChatbotMediaType, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
};
export const NOUN: Record<ChatbotMediaType, string> = {
  image: 'a JPEG or PNG',
  video: 'an MP4 or 3GPP video',
  audio: 'an audio file',
  document: 'a document',
};

const headerKinds = (kind: Draft['kind']): HeaderDraft['type'][] =>
  kind === 'location_request_message'
    ? ['none']
    : kind === 'list'
      ? ['none', 'text']
      : ['none', 'text', 'image', 'video', 'document'];

export interface InteractiveFieldsProps {
  draft: Draft;
  onChange(next: Draft): void;
  /** Problems keyed as the interactive model keys them (`interactive.body.text` → `keyFor`). */
  errors: Record<string, string>;
  isDisabled: boolean;
  variables: VariableGroup[];
  upload(file: File, type: ChatbotMediaType): Promise<{ id: string }>;
}

/**
 * The interactive composer's form for a Send message node (spec §8.1): the same fields as the inbox composer,
 * with the run's variables in the texts. Kept separate from the inbox copy so the composer stays as it is.
 */
export const InteractiveFields: React.FunctionComponent<InteractiveFieldsProps> = ({
  draft,
  onChange,
  errors,
  isDisabled,
  variables,
  upload,
}) => {
  const [uploading, setUploading] = React.useState(false);
  const [uploadProblem, setUploadProblem] = React.useState<string | null>(null);
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const err = (path: string) => errors[keyFor(path)];
  const headerType = draft.header.type;
  const mediaHeader = headerType === 'image' || headerType === 'video' || headerType === 'document';

  const doUpload = async (files: File[]) => {
    const file = files[0];
    const type = draft.header.type;
    if (!file || type === 'none' || type === 'text') return;
    setUploadProblem(null);
    setUploading(true);
    try {
      const { id } = await upload(file, type);
      onChange({ ...draft, header: { ...draft.header, mediaId: id, fileName: file.name } });
    } catch (e) {
      setUploadProblem(e instanceof Error ? e.message : 'The upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <FormGroup label="Interactive kind" fieldId="ic-kind">
        <FormSelect
          id="ic-kind"
          aria-label="Interactive kind"
          value={draft.kind}
          isDisabled={isDisabled}
          onChange={(_e, v) => {
            const kind = v as Draft['kind'];
            const allowed = headerKinds(kind);
            update({
              kind,
              header:
                allowed.indexOf(draft.header.type) >= 0
                  ? draft.header
                  : { type: 'none', text: '', mediaId: null, fileName: null },
            });
          }}
        >
          {KINDS.map((k) => (
            <FormSelectOption key={k.value} value={k.value} label={k.label} />
          ))}
        </FormSelect>
      </FormGroup>

      {draft.kind !== 'location_request_message' && (
        <FormGroup label="Header" fieldId="ic-header">
          <FormSelect
            id="ic-header"
            aria-label="Header"
            value={headerType}
            isDisabled={isDisabled}
            onChange={(_e, v) =>
              update({ header: { type: v as HeaderDraft['type'], text: '', mediaId: null, fileName: null } })
            }
          >
            {headerKinds(draft.kind).map((h) => (
              <FormSelectOption
                key={h}
                value={h}
                label={h === 'none' ? 'None' : h.charAt(0).toUpperCase() + h.slice(1)}
              />
            ))}
          </FormSelect>
          {headerType === 'text' && (
            <>
              <VariableInput
                id="ic-header-text"
                aria-label="Header text"
                value={draft.header.text}
                maxLength={LIMITS.headerText}
                onChange={(v) => update({ header: { ...draft.header, text: v } })}
                variables={variables}
                isDisabled={isDisabled}
              />
              <ErrorLine message={err('interactive.header.text')} />
            </>
          )}
          {mediaHeader && (
            <>
              <FileUpload
                id="ic-header-file"
                filename={draft.header.fileName ?? ''}
                filenamePlaceholder={`Drag ${NOUN[headerType]} here, or browse`}
                browseButtonText="Browse"
                hideDefaultPreview
                isLoading={uploading}
                isDisabled={isDisabled}
                onClearClick={() => update({ header: { ...draft.header, mediaId: null, fileName: null } })}
                dropzoneProps={{
                  accept: ACCEPT[headerType],
                  maxSize: MAX_BYTES[headerType],
                  onDropAccepted: (files) => void doUpload(files),
                  onDropRejected: () =>
                    setUploadProblem(`Choose ${NOUN[headerType]} under ${MAX_BYTES[headerType] / (1024 * 1024)} MB.`),
                }}
              />
              {uploadProblem && <Alert variant="danger" isInline isPlain title={uploadProblem} />}
              <ErrorLine message={err(`interactive.header.${headerType}.id`)} />
            </>
          )}
        </FormGroup>
      )}

      <FormGroup label="Body" isRequired fieldId="ic-body">
        <VariableInput
          id="ic-body"
          aria-label="Body"
          multiline
          rows={4}
          value={draft.body}
          maxLength={draft.kind === 'list' ? LIMITS.listBody : LIMITS.body}
          onChange={(v) => update({ body: v })}
          variables={variables}
          isDisabled={isDisabled}
          validated={err('interactive.body.text') ? 'error' : 'default'}
        />
        <ErrorLine message={err('interactive.body.text')} />
      </FormGroup>

      {draft.kind !== 'location_request_message' && (
        <FormGroup label="Footer" fieldId="ic-footer">
          <VariableInput
            id="ic-footer"
            aria-label="Footer"
            value={draft.footer}
            maxLength={LIMITS.footer}
            onChange={(v) => update({ footer: v })}
            variables={variables}
            isDisabled={isDisabled}
          />
          <ErrorLine message={err('interactive.footer.text')} />
        </FormGroup>
      )}

      {draft.kind === 'button' && (
        <FormGroup label="Reply buttons" fieldId="ic-buttons">
          {draft.buttons.map((b, n) => (
            <div key={n} className="omni-form-field__row">
              <div style={{ flex: 2 }}>
                <TextInput
                  aria-label={`Button ${n + 1} title`}
                  placeholder="Title"
                  value={b.title}
                  maxLength={LIMITS.buttonTitle}
                  isDisabled={isDisabled}
                  onChange={(_e, v) =>
                    update({ buttons: draft.buttons.map((x, i) => (i === n ? withTitle(x, v, `button-${n + 1}`) : x)) })
                  }
                />
                <ErrorLine message={err(`interactive.action.buttons.${n}.reply.title`)} />
              </div>
              <div style={{ flex: 1 }}>
                <TextInput
                  aria-label={`Button ${n + 1} id`}
                  placeholder="id"
                  value={b.id}
                  isDisabled={isDisabled}
                  onChange={(_e, v) =>
                    update({ buttons: draft.buttons.map((x, i) => (i === n ? { ...x, id: v, idEdited: true } : x)) })
                  }
                />
                <ErrorLine message={err(`interactive.action.buttons.${n}.reply.id`)} />
              </div>
              <Button
                variant="plain"
                aria-label={`Remove button ${n + 1}`}
                isDisabled={isDisabled || draft.buttons.length === 1}
                onClick={() => update({ buttons: draft.buttons.filter((_x, i) => i !== n) })}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="link"
            isInline
            isDisabled={isDisabled || draft.buttons.length >= LIMITS.buttons}
            onClick={() => update({ buttons: [...draft.buttons, { id: '', title: '', idEdited: false }] })}
          >
            Add button
          </Button>
          <ErrorLine message={err('interactive.action.buttons')} />
        </FormGroup>
      )}

      {draft.kind === 'list' && (
        <>
          <FormGroup label="List button label" isRequired fieldId="ic-list-button">
            <TextInput
              id="ic-list-button"
              aria-label="List button label"
              value={draft.listButton}
              maxLength={LIMITS.listButton}
              isDisabled={isDisabled}
              onChange={(_e, v) => update({ listButton: v })}
            />
            <ErrorLine message={err('interactive.action.button')} />
          </FormGroup>
          {draft.sections.map((s, i) => (
            <FormGroup key={i} label={`Section ${i + 1}`} fieldId={`ic-section-${i}`}>
              <div className="omni-form-field__row">
                <TextInput
                  id={`ic-section-${i}`}
                  aria-label={`Section ${i + 1} title`}
                  placeholder="Section title"
                  value={s.title}
                  maxLength={LIMITS.sectionTitle}
                  isDisabled={isDisabled}
                  onChange={(_e, v) =>
                    update({ sections: draft.sections.map((x, j) => (j === i ? { ...x, title: v } : x)) })
                  }
                />
                <Button
                  variant="plain"
                  aria-label={`Remove section ${i + 1}`}
                  isDisabled={isDisabled || draft.sections.length === 1}
                  onClick={() => update({ sections: draft.sections.filter((_x, j) => j !== i) })}
                >
                  ×
                </Button>
              </div>
              <ErrorLine message={err(`interactive.action.sections.${i}.title`)} />
              {s.rows.map((r, n) => {
                const setRow = (
                  row:
                    | Partial<Draft['sections'][number]['rows'][number]>
                    | ((y: Draft['sections'][number]['rows'][number]) => Draft['sections'][number]['rows'][number]),
                ) =>
                  update({
                    sections: draft.sections.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            rows: x.rows.map((y, m) =>
                              m === n ? (typeof row === 'function' ? row(y) : { ...y, ...row }) : y,
                            ),
                          }
                        : x,
                    ),
                  });
                return (
                  <div key={n} className="omni-form-field__row omni-form-field__row--indent">
                    <div style={{ flex: 2 }}>
                      <TextInput
                        aria-label={`Section ${i + 1} row ${n + 1} title`}
                        placeholder="Row title"
                        value={r.title}
                        maxLength={LIMITS.rowTitle}
                        isDisabled={isDisabled}
                        onChange={(_e, v) => setRow((y) => withTitle(y, v, `row-${n + 1}`))}
                      />
                      <ErrorLine message={err(`interactive.action.sections.${i}.rows.${n}.title`)} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <TextInput
                        aria-label={`Section ${i + 1} row ${n + 1} description`}
                        placeholder="Description"
                        value={r.description}
                        maxLength={LIMITS.rowDescription}
                        isDisabled={isDisabled}
                        onChange={(_e, v) => setRow({ description: v })}
                      />
                      <ErrorLine message={err(`interactive.action.sections.${i}.rows.${n}.description`)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextInput
                        aria-label={`Section ${i + 1} row ${n + 1} id`}
                        placeholder="id"
                        value={r.id}
                        isDisabled={isDisabled}
                        onChange={(_e, v) => setRow({ id: v, idEdited: true })}
                      />
                      <ErrorLine message={err(`interactive.action.sections.${i}.rows.${n}.id`)} />
                    </div>
                    <Button
                      variant="plain"
                      aria-label={`Remove section ${i + 1} row ${n + 1}`}
                      isDisabled={isDisabled || s.rows.length === 1}
                      onClick={() =>
                        update({
                          sections: draft.sections.map((x, j) =>
                            j === i ? { ...x, rows: x.rows.filter((_y, m) => m !== n) } : x,
                          ),
                        })
                      }
                    >
                      ×
                    </Button>
                  </div>
                );
              })}
              <ErrorLine message={err(`interactive.action.sections.${i}.rows`)} />
              <Button
                variant="link"
                isInline
                isDisabled={isDisabled}
                onClick={() =>
                  update({
                    sections: draft.sections.map((x, j) =>
                      j === i
                        ? { ...x, rows: [...x.rows, { id: '', title: '', description: '', idEdited: false }] }
                        : x,
                    ),
                  })
                }
              >
                Add row
              </Button>
            </FormGroup>
          ))}
          <div>
            <Button
              variant="link"
              isInline
              isDisabled={isDisabled || draft.sections.length >= LIMITS.sections}
              onClick={() =>
                update({
                  sections: [
                    ...draft.sections,
                    { title: '', rows: [{ id: '', title: '', description: '', idEdited: false }] },
                  ],
                })
              }
            >
              Add section
            </Button>
            <ErrorLine message={err('interactive.action.sections')} />
          </div>
        </>
      )}

      {draft.kind === 'cta_url' && (
        <>
          <FormGroup label="Link text" isRequired fieldId="ic-cta-text">
            <TextInput
              id="ic-cta-text"
              aria-label="Link text"
              value={draft.cta.text}
              maxLength={LIMITS.ctaText}
              isDisabled={isDisabled}
              onChange={(_e, v) => update({ cta: { ...draft.cta, text: v } })}
            />
            <ErrorLine message={err('interactive.action.parameters.display_text')} />
          </FormGroup>
          <FormGroup label="Link URL" isRequired fieldId="ic-cta-url">
            <VariableInput
              id="ic-cta-url"
              aria-label="Link URL"
              placeholder="https://"
              value={draft.cta.url}
              onChange={(v) => update({ cta: { ...draft.cta, url: v } })}
              variables={variables}
              isDisabled={isDisabled}
            />
            <ErrorLine message={err('interactive.action.parameters.url')} />
          </FormGroup>
        </>
      )}
    </>
  );
};
