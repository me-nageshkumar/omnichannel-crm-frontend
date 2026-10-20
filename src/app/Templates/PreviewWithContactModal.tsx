import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  SimpleList,
  SimpleListItem,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { messageFor } from '@app/api/messages';
import { Contact, searchContacts } from '@app/api/contacts';
import { RenderedTemplate, renderTemplate } from '@app/api/templates';
import { useSession } from '@app/session/SessionContext';
import { Settings, settingFor } from '@app/Templates/editorModel';
import type { PlaceholderRef } from '@app/Templates/placeholders';
import { TemplateBubble } from '@app/Templates/TemplateBubble';

const SHOWN = 10;

const nameOf = (c: Contact) => c.name ?? (c.numberHidden ? 'Number hidden' : 'No name');

/**
 * Renders a saved template on the server for a real contact and the agent's own values, and shows what
 * the contact would receive. The contact is optional: without one, contact fields use their fallbacks.
 */
export const PreviewWithContactModal: React.FunctionComponent<{
  templateId: string;
  refs: PlaceholderRef[];
  settings: Settings;
  onClose(): void;
}> = ({ templateId, refs, settings, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const agentRefs = refs.filter((r) => r.kind === 'AGENT');

  const [search, setSearch] = React.useState('');
  const [found, setFound] = React.useState<Contact[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [chosen, setChosen] = React.useState<Contact | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(agentRefs.map((r) => [r.name, settingFor(settings, r).example])),
  );
  const [result, setResult] = React.useState<RenderedTemplate | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const q = search.trim();
    if (!q) {
      setFound([]);
      setSearching(false);
      return undefined;
    }
    let live = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchContacts(t, ws, { filter: { q } }).then(
        (page) => {
          if (!live) return;
          setFound(page.items.slice(0, SHOWN));
          setSearching(false);
        },
        (e) => {
          if (!live) return;
          setFound([]);
          setSearching(false);
          setError(messageFor(e));
        },
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search, t, ws]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await renderTemplate(t, ws, templateId, {
          ...(chosen ? { contactId: chosen.id } : {}),
          values: Object.fromEntries(agentRefs.map((r) => [r.name, values[r.name] ?? ''])),
        }),
      );
    } catch (e) {
      setResult(null);
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const labelOf = (name: string) => {
    const ref = refs.find((r) => r.name === name);
    return (ref && settingFor(settings, ref).label) || name;
  };

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="preview-contact-title">
      <ModalHeader title="Preview with a contact" labelId="preview-contact-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormGroup label="Contact" fieldId="preview-contact-search">
            {chosen ? (
              <Label
                color="blue"
                onClose={() => {
                  setChosen(null);
                  setResult(null);
                }}
                closeBtnAriaLabel="Remove contact"
              >
                {nameOf(chosen)}
                {chosen.phone ? ` +${chosen.phone}` : ''}
              </Label>
            ) : (
              <>
                <TextInput
                  id="preview-contact-search"
                  type="search"
                  aria-label="Search contacts"
                  placeholder="Search by name or number (optional)"
                  value={search}
                  onChange={(_e, v) => setSearch(v)}
                />
                {searching && <Spinner size="md" aria-label="Searching contacts" />}
                {found.length > 0 && (
                  <SimpleList aria-label="Matching contacts">
                    {found.map((c) => (
                      <SimpleListItem
                        key={c.id}
                        onClick={() => {
                          setChosen(c);
                          setResult(null);
                        }}
                      >
                        <strong>{nameOf(c)}</strong>
                        {c.phone && <div>+{c.phone}</div>}
                      </SimpleListItem>
                    ))}
                  </SimpleList>
                )}
              </>
            )}
          </FormGroup>
          {agentRefs.map((ref) => {
            const s = settingFor(settings, ref);
            return (
              <FormGroup
                key={ref.name}
                label={s.label || ref.name}
                fieldId={`preview-value-${ref.name}`}
                isRequired={s.required}
              >
                <TextInput
                  id={`preview-value-${ref.name}`}
                  aria-label={s.label || ref.name}
                  value={values[ref.name] ?? ''}
                  onChange={(_e, v) => setValues((all) => ({ ...all, [ref.name]: v }))}
                />
              </FormGroup>
            );
          })}
        </Form>
        {result && (
          <div style={{ marginTop: 16 }}>
            {result.missing.length > 0 && (
              <Alert variant="warning" isInline isPlain title={`Fill in: ${result.missing.map(labelOf).join(', ')}`} />
            )}
            {result.warnings.map((w) => (
              <Alert key={w} variant="warning" isInline isPlain title={w} />
            ))}
            <TemplateBubble label="Rendered message" type={result.type} content={result.content} media={result.media} />
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={() => void run()} isDisabled={busy} isLoading={busy}>
          Preview
        </Button>
        <Button variant="link" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};
