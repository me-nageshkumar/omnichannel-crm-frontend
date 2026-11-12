import * as React from 'react';
import {
  Alert,
  Button,
  FileUpload,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tab,
  TabTitleText,
  Tabs,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { previewCloudMessage, sendCloudMessage, uploadCloudMedia } from '@app/api/cloudMessages';
import type { ChatView } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import {
  Draft,
  HeaderDraft,
  KINDS,
  LIMITS,
  initialDraft,
  keyFor,
  problems,
  renderedPaths,
  toCloudMessage,
  withTitle,
} from '@app/Inbox/interactiveModel';
import { useSession } from '@app/session/SessionContext';

const DEBOUNCE_MS = 400;
const GAP = 'var(--pf-t--global--spacer--sm)';

const ACCEPT: Record<'image' | 'video' | 'document', Record<string, string[]>> = {
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
const MAX_BYTES = { image: 5 * 1024 * 1024, video: 16 * 1024 * 1024, document: 16 * 1024 * 1024 } as const;
const NOUN = { image: 'a JPEG or PNG', video: 'an MP4 or 3GPP video', document: 'a document' } as const;

/** The field's helper line: the server's sentence for its JSON path, else the client's. */
function Problem({ errors, path }: { errors: Record<string, string>; path: string }) {
  const text = errors[keyFor(path)];
  if (!text) return null;
  return (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{text}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  );
}

const headerKinds = (kind: Draft['kind']): HeaderDraft['type'][] =>
  kind === 'location_request_message'
    ? ['none']
    : kind === 'list'
      ? ['none', 'text']
      : ['none', 'text', 'image', 'video', 'document'];

/**
 * Composes a Cloud API interactive message for an open chat (spec §5.8): the form on the left, the server's
 * rendering of the page the message will be sent as and the live Cloud object on the right.
 */
export const InteractiveComposer: React.FunctionComponent<{
  chat: ChatView;
  onClose(): void;
  onSent(messageId: string): void;
}> = ({ chat, onClose, onSent }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;

  const [draft, setDraft] = React.useState<Draft>(initialDraft);
  const [serverErrors, setServerErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProblem, setUploadProblem] = React.useState<string | null>(null);
  const [html, setHtml] = React.useState<string | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [tab, setTab] = React.useState<string | number>('preview');
  const inFlight = React.useRef(false);

  const clientProblems = React.useMemo(() => problems(draft), [draft]);
  const errors = React.useMemo(() => ({ ...clientProblems, ...serverErrors }), [clientProblems, serverErrors]);
  const message = React.useMemo(() => toCloudMessage(draft), [draft]);
  const complete = Object.keys(clientProblems).length === 0;
  const canSend = complete && !sending && !uploading;

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setServerErrors({});
  };

  /** A VALIDATION error lands on its fields; a key the form has no field for becomes the form-level alert. */
  const showServerError = (e: unknown) => {
    const fields = e instanceof ApiError && e.code?.toUpperCase() === 'VALIDATION' ? e.fields : undefined;
    const keys = Object.keys(fields ?? {});
    if (keys.length > 0) setServerErrors(fields as Record<string, string>);
    const known = renderedPaths(draft);
    if (keys.length > 0 && keys.every((k) => known.indexOf(keyFor(k)) >= 0)) return;
    setError((e instanceof ApiError && e.serverMessage) || messageFor(e));
  };

  // the preview effect reports errors through the latest handler without depending on it (it closes over draft)
  const showServerErrorRef = React.useRef(showServerError);
  showServerErrorRef.current = showServerError;

  React.useEffect(() => {
    if (!complete) {
      setHtml(null);
      setRendering(false);
      return undefined;
    }
    let live = true;
    setRendering(true);
    const timer = setTimeout(() => {
      previewCloudMessage(t, ws, chat.phoneNumberId, message).then(
        (h) => {
          if (!live) return;
          setHtml(h);
          setRendering(false);
          setError(null);
        },
        (e) => {
          if (!live) return;
          setRendering(false);
          setHtml(null);
          showServerErrorRef.current(e);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [message, complete, t, ws, chat.phoneNumberId]);

  const send = async () => {
    if (!canSend || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    setServerErrors({});
    try {
      const res = await sendCloudMessage(t, ws, chat.id, message);
      onSent(res.messages[0]?.id ?? '');
    } catch (e) {
      showServerError(e);
      inFlight.current = false;
      setSending(false);
    }
  };

  const upload = async (files: File[]) => {
    const file = files[0];
    const type = draft.header.type;
    if (!file || type === 'none' || type === 'text') return;
    setUploadProblem(null);
    setUploading(true);
    try {
      const { id } = await uploadCloudMedia(t, ws, chat.phoneNumberId, type, file);
      // the header this upload was for may be gone by now (kind or header type changed): then drop the result
      setDraft((d) =>
        d.header.type === type ? { ...d, header: { ...d.header, mediaId: id, fileName: file.name } } : d,
      );
      setServerErrors({});
    } catch (e) {
      setUploadProblem(messageFor(e));
    } finally {
      setUploading(false);
    }
  };

  const headerType = draft.header.type;
  const mediaHeader = headerType === 'image' || headerType === 'video' || headerType === 'document';

  return (
    <Modal isOpen variant="large" onClose={onClose} aria-labelledby="interactive-composer-title">
      <ModalHeader title="Send an interactive message" labelId="interactive-composer-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 420px',
            gap: 'var(--pf-t--global--spacer--lg)',
          }}
        >
          <Form onSubmit={(e) => e.preventDefault()}>
            <FormGroup label="Message kind" fieldId="ic-kind">
              <FormSelect
                id="ic-kind"
                aria-label="Message kind"
                value={draft.kind}
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
                  <div style={{ marginTop: GAP }}>
                    <TextInput
                      aria-label="Header text"
                      value={draft.header.text}
                      maxLength={LIMITS.headerText}
                      onChange={(_e, v) => update({ header: { ...draft.header, text: v } })}
                    />
                    <Problem errors={errors} path="interactive.header.text" />
                  </div>
                )}
                {mediaHeader && (
                  <div style={{ marginTop: GAP }}>
                    <FileUpload
                      id="header-file"
                      filename={draft.header.fileName ?? ''}
                      filenamePlaceholder={`Drag ${NOUN[headerType]} here, or browse`}
                      browseButtonText="Browse"
                      hideDefaultPreview
                      isLoading={uploading}
                      onClearClick={() => update({ header: { ...draft.header, mediaId: null, fileName: null } })}
                      dropzoneProps={{
                        accept: ACCEPT[headerType],
                        maxSize: MAX_BYTES[headerType],
                        onDropAccepted: (files) => void upload(files),
                        onDropRejected: () =>
                          setUploadProblem(
                            `Choose ${NOUN[headerType]} under ${MAX_BYTES[headerType] / (1024 * 1024)} MB.`,
                          ),
                      }}
                    />
                    {uploadProblem && <Alert variant="danger" isInline isPlain title={uploadProblem} />}
                    <Problem errors={errors} path={`interactive.header.${headerType}.id`} />
                  </div>
                )}
              </FormGroup>
            )}

            <FormGroup label="Body" isRequired fieldId="ic-body">
              <TextArea
                id="ic-body"
                aria-label="Body"
                resizeOrientation="vertical"
                rows={4}
                value={draft.body}
                maxLength={draft.kind === 'list' ? LIMITS.listBody : LIMITS.body}
                onChange={(_e, v) => update({ body: v })}
              />
              <Problem errors={errors} path="interactive.body.text" />
            </FormGroup>

            {draft.kind !== 'location_request_message' && (
              <FormGroup label="Footer" fieldId="ic-footer">
                <TextInput
                  id="ic-footer"
                  aria-label="Footer"
                  value={draft.footer}
                  maxLength={LIMITS.footer}
                  onChange={(_e, v) => update({ footer: v })}
                />
                <Problem errors={errors} path="interactive.footer.text" />
              </FormGroup>
            )}

            {draft.kind === 'button' &&
              draft.buttons.map((b, n) => (
                <FormGroup key={n} label={`Button ${n + 1}`} fieldId={`ic-button-${n}`}>
                  <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start' }}>
                    <div style={{ flex: 2 }}>
                      <TextInput
                        id={`ic-button-${n}`}
                        aria-label={`Button ${n + 1} title`}
                        placeholder="Title"
                        value={b.title}
                        maxLength={LIMITS.buttonTitle}
                        onChange={(_e, v) =>
                          update({
                            buttons: draft.buttons.map((x, i) => (i === n ? withTitle(x, v, `button-${n + 1}`) : x)),
                          })
                        }
                      />
                      <Problem errors={errors} path={`interactive.action.buttons.${n}.reply.title`} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextInput
                        aria-label={`Button ${n + 1} id`}
                        placeholder="id"
                        value={b.id}
                        onChange={(_e, v) =>
                          update({
                            buttons: draft.buttons.map((x, i) => (i === n ? { ...x, id: v, idEdited: true } : x)),
                          })
                        }
                      />
                      <Problem errors={errors} path={`interactive.action.buttons.${n}.reply.id`} />
                    </div>
                    <Button
                      variant="plain"
                      aria-label={`Remove button ${n + 1}`}
                      isDisabled={draft.buttons.length === 1}
                      onClick={() => update({ buttons: draft.buttons.filter((_x, i) => i !== n) })}
                    >
                      ×
                    </Button>
                  </div>
                </FormGroup>
              ))}
            {draft.kind === 'button' && (
              <div>
                <Button
                  variant="link"
                  isInline
                  isDisabled={draft.buttons.length >= LIMITS.buttons}
                  onClick={() => update({ buttons: [...draft.buttons, { id: '', title: '', idEdited: false }] })}
                >
                  Add button
                </Button>
                <Problem errors={errors} path="interactive.action.buttons" />
              </div>
            )}

            {draft.kind === 'list' && (
              <>
                <FormGroup label="List button label" isRequired fieldId="ic-list-button">
                  <TextInput
                    id="ic-list-button"
                    aria-label="List button label"
                    value={draft.listButton}
                    maxLength={LIMITS.listButton}
                    onChange={(_e, v) => update({ listButton: v })}
                  />
                  <Problem errors={errors} path="interactive.action.button" />
                </FormGroup>
                {draft.sections.map((s, i) => (
                  <FormGroup key={i} label={`Section ${i + 1}`} fieldId={`ic-section-${i}`}>
                    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <TextInput
                          id={`ic-section-${i}`}
                          aria-label={`Section ${i + 1} title`}
                          placeholder="Section title"
                          value={s.title}
                          maxLength={LIMITS.sectionTitle}
                          onChange={(_e, v) =>
                            update({ sections: draft.sections.map((x, j) => (j === i ? { ...x, title: v } : x)) })
                          }
                        />
                        <Problem errors={errors} path={`interactive.action.sections.${i}.title`} />
                      </div>
                      <Button
                        variant="plain"
                        aria-label={`Remove section ${i + 1}`}
                        isDisabled={draft.sections.length === 1}
                        onClick={() => update({ sections: draft.sections.filter((_x, j) => j !== i) })}
                      >
                        ×
                      </Button>
                    </div>
                    {s.rows.map((r, n) => (
                      <div
                        key={n}
                        style={{
                          display: 'flex',
                          gap: GAP,
                          alignItems: 'flex-start',
                          marginTop: GAP,
                          paddingLeft: GAP,
                        }}
                      >
                        <div style={{ flex: 2 }}>
                          <TextInput
                            aria-label={`Section ${i + 1} row ${n + 1} title`}
                            placeholder="Row title"
                            value={r.title}
                            maxLength={LIMITS.rowTitle}
                            onChange={(_e, v) =>
                              update({
                                sections: draft.sections.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        rows: x.rows.map((y, m) => (m === n ? withTitle(y, v, `row-${n + 1}`) : y)),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                          <Problem errors={errors} path={`interactive.action.sections.${i}.rows.${n}.title`} />
                        </div>
                        <div style={{ flex: 2 }}>
                          <TextInput
                            aria-label={`Section ${i + 1} row ${n + 1} description`}
                            placeholder="Description"
                            value={r.description}
                            maxLength={LIMITS.rowDescription}
                            onChange={(_e, v) =>
                              update({
                                sections: draft.sections.map((x, j) =>
                                  j === i
                                    ? { ...x, rows: x.rows.map((y, m) => (m === n ? { ...y, description: v } : y)) }
                                    : x,
                                ),
                              })
                            }
                          />
                          <Problem errors={errors} path={`interactive.action.sections.${i}.rows.${n}.description`} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextInput
                            aria-label={`Section ${i + 1} row ${n + 1} id`}
                            placeholder="id"
                            value={r.id}
                            onChange={(_e, v) =>
                              update({
                                sections: draft.sections.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        rows: x.rows.map((y, m) => (m === n ? { ...y, id: v, idEdited: true } : y)),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                          <Problem errors={errors} path={`interactive.action.sections.${i}.rows.${n}.id`} />
                        </div>
                        <Button
                          variant="plain"
                          aria-label={`Remove section ${i + 1} row ${n + 1}`}
                          isDisabled={s.rows.length === 1}
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
                    ))}
                    <Problem errors={errors} path={`interactive.action.sections.${i}.rows`} />
                    <Button
                      variant="link"
                      isInline
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
                    isDisabled={draft.sections.length >= LIMITS.sections}
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
                  <Problem errors={errors} path="interactive.action.sections" />
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
                    onChange={(_e, v) => update({ cta: { ...draft.cta, text: v } })}
                  />
                  <Problem errors={errors} path="interactive.action.parameters.display_text" />
                </FormGroup>
                <FormGroup label="Link URL" isRequired fieldId="ic-cta-url">
                  <TextInput
                    id="ic-cta-url"
                    aria-label="Link URL"
                    placeholder="https://"
                    value={draft.cta.url}
                    onChange={(_e, v) => update({ cta: { ...draft.cta, url: v } })}
                  />
                  <Problem errors={errors} path="interactive.action.parameters.url" />
                </FormGroup>
              </>
            )}
          </Form>

          <div>
            <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k)} aria-label="Preview and JSON">
              <Tab eventKey="preview" title={<TabTitleText>Preview</TabTitleText>}>
                <div
                  style={{
                    marginTop: GAP,
                    width: 380,
                    height: 640,
                    border: '8px solid var(--pf-t--global--border--color--default)',
                    borderRadius: 24,
                    overflow: 'hidden',
                    background: '#efeae2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {html ? (
                    <iframe
                      title="Preview"
                      sandbox="allow-scripts"
                      srcDoc={html}
                      style={{ width: '100%', height: '100%', border: 0 }}
                    />
                  ) : rendering ? (
                    <Spinner size="lg" aria-label="Rendering the preview" />
                  ) : (
                    <span
                      style={{ color: 'var(--pf-t--global--text--color--subtle)', padding: GAP, textAlign: 'center' }}
                    >
                      Fill in the message to see how it will look
                    </span>
                  )}
                </div>
              </Tab>
              <Tab eventKey="json" title={<TabTitleText>JSON</TabTitleText>}>
                <pre
                  data-testid="cloud-json"
                  style={{
                    marginTop: GAP,
                    maxHeight: 640,
                    overflow: 'auto',
                    fontSize: 'var(--pf-t--global--font--size--sm)',
                  }}
                >
                  {JSON.stringify(message, null, 2)}
                </pre>
              </Tab>
            </Tabs>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={() => void send()} isDisabled={!canSend} isLoading={sending}>
          Send
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
