import * as React from 'react';
import {
  Alert,
  Button,
  FileUpload,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { CloudTemplate, CloudTemplateFill, listCloudTemplates } from '@app/api/cloudTemplates';
import { uploadCloudMedia } from '@app/api/cloudMessages';
import type { CloudTemplateSend, MessageView } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { CloudTemplatePreview } from '@app/CloudTemplates/CloudTemplatePreview';

/** What a fill can say on the client: the contact's name or phone; other fills are left to the server. */
function prefill(f: CloudTemplateFill | undefined, contact: { name: string | null; phone: string | null } | null) {
  if (!f || !contact || f.kind !== 'CONTACT_FIELD') return '';
  if (f.attributeKey === 'phone') return contact.phone ? `+${contact.phone}` : '';
  return contact.name ?? '';
}

/** A fill the server resolves when the value is left empty (a contact field the client does not have). */
const filledByServer = (f: CloudTemplateFill | undefined) => f?.kind === 'CONTACT_ATTRIBUTE';

/**
 * Picks an approved WhatsApp template of the number's WABA, fills its blanks (pre-filled from the contact where the
 * template says so), asks for the header file a media header needs, previews it, and sends (spec 2026-11-20 §5.6).
 */
export const CloudTemplatePickerModal: React.FunctionComponent<{
  phoneNumberId: string;
  contact: { name: string | null; phone: string | null } | null;
  send(body: CloudTemplateSend): Promise<MessageView>;
  onClose(): void;
  onSent(message: MessageView): void;
}> = ({ phoneNumberId, contact, send, onClose, onSent }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const templates = useLoad((t) => listCloudTemplates(t, ws, { phoneNumberId, sendable: true }), [ws, phoneNumberId]);
  const [picked, setPicked] = React.useState<CloudTemplate | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [file, setFile] = React.useState<File | null>(null);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pick = (t: CloudTemplate) => {
    setPicked(t);
    setFile(null);
    setError(null);
    setValues(Object.fromEntries(t.variables.map((v) => [v.key, prefill(t.fills[v.key], contact)])));
  };

  const mediaHeader = picked ? ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(picked.header.format) : false;
  const missing = picked
    ? picked.variables.filter((v) => !values[v.key]?.trim() && !filledByServer(picked.fills[v.key]))
    : [];
  const canSend = picked !== null && missing.length === 0 && (!mediaHeader || file !== null) && !sending;

  const onSend = async () => {
    if (!picked || !canSend) return;
    setSending(true);
    setError(null);
    try {
      let headerMediaId: string | undefined;
      if (mediaHeader && file) {
        const type = picked.header.format.toLowerCase() as 'image' | 'video' | 'document';
        headerMediaId = (await uploadCloudMedia(token as string, ws, phoneNumberId, type, file, 'whatsapp')).id;
      }
      const given = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
      onSent(await send({ cloudTemplateId: picked.id, values: given, ...(headerMediaId ? { headerMediaId } : {}) }));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen variant="medium" onClose={sending ? () => undefined : onClose} aria-labelledby="cloud-template-title">
      <ModalHeader title={picked ? picked.name : 'WhatsApp template'} labelId="cloud-template-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        {templates.error && <Alert variant="danger" isInline isPlain title={templates.error} />}
        {!picked &&
          (templates.loading && !templates.data ? (
            <Spinner size="md" aria-label="Loading WhatsApp templates" />
          ) : (templates.data ?? []).length === 0 ? (
            <p>No approved WhatsApp templates for this number. Sync them on WhatsApp templates.</p>
          ) : (
            <Menu aria-label="WhatsApp templates" isPlain>
              <MenuContent>
                <MenuList>
                  {(templates.data ?? []).map((t) => (
                    <MenuItem
                      key={t.id}
                      itemId={t.id}
                      onClick={() => pick(t)}
                      description={`${t.language} · ${t.category ?? ''}`}
                    >
                      {t.name}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuContent>
            </Menu>
          ))}
        {picked && (
          <>
            <CloudTemplatePreview template={picked} values={values} />
            <Form onSubmit={(e) => e.preventDefault()}>
              {picked.variables.map((v) => (
                <FormGroup
                  key={v.key}
                  label={v.key}
                  fieldId={`cloud-template-${v.key}`}
                  isRequired={!filledByServer(picked.fills[v.key])}
                >
                  <TextInput
                    id={`cloud-template-${v.key}`}
                    value={values[v.key] ?? ''}
                    placeholder={
                      filledByServer(picked.fills[v.key])
                        ? `From the contact's ${picked.fills[v.key]?.attributeKey}`
                        : (v.example ?? '')
                    }
                    onChange={(_e, value) => setValues((s) => ({ ...s, [v.key]: value }))}
                  />
                </FormGroup>
              ))}
              {mediaHeader && (
                <FormGroup
                  label={`Header ${picked.header.format.toLowerCase()}`}
                  fieldId="cloud-template-file"
                  isRequired
                >
                  <FileUpload
                    id="cloud-template-file"
                    filename={file?.name ?? ''}
                    browseButtonText="Choose file"
                    hideDefaultPreview
                    onFileInputChange={(_e, f) => setFile(f)}
                    onClearClick={() => setFile(null)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The template&apos;s header needs this file.</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              )}
            </Form>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {picked && (
          <Button variant="primary" onClick={() => void onSend()} isDisabled={!canSend} isLoading={sending}>
            Send
          </Button>
        )}
        {picked && (
          <Button variant="secondary" onClick={() => setPicked(null)} isDisabled={sending}>
            Back
          </Button>
        )}
        <Button variant="link" onClick={onClose} isDisabled={sending}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
