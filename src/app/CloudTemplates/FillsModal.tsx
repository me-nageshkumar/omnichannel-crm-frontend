import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { CloudTemplate, CloudTemplateFill, saveCloudTemplateFills } from '@app/api/cloudTemplates';
import { listAttributes } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

/** One choice per source: none, the contact's name or phone, or one of the brand's contact fields. */
const NONE = '';

const sourceOf = (f?: CloudTemplateFill): string => {
  if (!f) return NONE;
  if (f.kind === 'CONTACT_FIELD') return `field:${f.attributeKey ?? 'name'}`;
  if (f.kind === 'CONTACT_ATTRIBUTE') return `attr:${f.attributeKey ?? ''}`;
  return 'agent';
};

const fillOf = (source: string, fallback: string): CloudTemplateFill | null => {
  const fb = fallback.trim() || null;
  if (source.startsWith('field:')) return { kind: 'CONTACT_FIELD', attributeKey: source.slice(6), fallback: fb };
  if (source.startsWith('attr:')) return { kind: 'CONTACT_ATTRIBUTE', attributeKey: source.slice(5), fallback: fb };
  if (source === 'agent') return { kind: 'AGENT', fallback: fb };
  return null;
};

/** Where each blank of a WhatsApp template takes its value from by default (the sender can still change it). */
export const FillsModal: React.FunctionComponent<{
  template: CloudTemplate;
  onSaved(saved: CloudTemplate): void;
  onCancel(): void;
}> = ({ template, onSaved, onCancel }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const attributes = useLoad((t) => listAttributes(t, ws), [ws]);
  const [sources, setSources] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(template.variables.map((v) => [v.key, sourceOf(template.fills[v.key])])),
  );
  const [fallbacks, setFallbacks] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(template.variables.map((v) => [v.key, template.fills[v.key]?.fallback ?? ''])),
  );
  const action = useAction();

  const save = async () => {
    const fills: Record<string, CloudTemplateFill> = {};
    for (const v of template.variables) {
      const f = fillOf(sources[v.key] ?? NONE, fallbacks[v.key] ?? '');
      if (f) fills[v.key] = f;
    }
    const result = await action.run(() => saveCloudTemplateFills(token as string, ws, template.id, fills));
    if (result !== undefined) onSaved(result);
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="fills-title">
      <ModalHeader title={`Fill ${template.name}`} labelId="fills-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form>
          {template.variables.map((v) => (
            <FormGroup
              key={v.key}
              label={`${v.key}${v.example ? ` (e.g. ${v.example})` : ''}`}
              fieldId={`fill-${v.key}`}
            >
              <FormSelect
                id={`fill-${v.key}`}
                aria-label={`Fill ${v.key} from`}
                value={sources[v.key] ?? NONE}
                onChange={(_e, value) => setSources((s) => ({ ...s, [v.key]: value }))}
              >
                <FormSelectOption value={NONE} label="Typed when sending" />
                <FormSelectOption value="field:name" label="Contact name" />
                <FormSelectOption value="field:phone" label="Contact phone" />
                {(attributes.data ?? []).map((a) => (
                  <FormSelectOption key={a.id} value={`attr:${a.key}`} label={`Contact field: ${a.name}`} />
                ))}
              </FormSelect>
              {(sources[v.key] ?? NONE) !== NONE && (
                <TextInput
                  aria-label={`Fallback for ${v.key}`}
                  className="pf-v6-u-mt-sm"
                  value={fallbacks[v.key] ?? ''}
                  onChange={(_e, value) => setFallbacks((f) => ({ ...f, [v.key]: value }))}
                  placeholder="When the contact has none (optional)"
                />
              )}
            </FormGroup>
          ))}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button onClick={save} isDisabled={action.busy} isLoading={action.busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
