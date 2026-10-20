import * as React from 'react';
import {
  Alert,
  Button,
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
  SearchInput,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { ChatView, MessageView, sendTemplate } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import {
  PlaceholderView,
  RenderedTemplate,
  TemplateView,
  getTemplate,
  listTemplates,
  renderTemplate,
} from '@app/api/templates';
import { useSession } from '@app/session/SessionContext';
import { TemplateBubble } from '@app/Templates/TemplateBubble';
import { TYPE_META } from '@app/Templates/typeMeta';

const DEBOUNCE_MS = 300;

const labelOf = (p: PlaceholderView) => p.label || p.name;

/**
 * Picks an active template, asks for its agent values, shows what the contact would receive and sends it.
 * The preview is rendered by the server, so it is exactly what the send will produce.
 */
export const TemplatePickerModal: React.FunctionComponent<{
  chat: ChatView;
  onClose(): void;
  onSent(message: MessageView): void;
}> = ({ chat, onClose, onSent }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;

  const [search, setSearch] = React.useState('');
  const [templates, setTemplates] = React.useState<TemplateView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [chosen, setChosen] = React.useState<TemplateView | null>(null);
  const [opening, setOpening] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<RenderedTemplate | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const inFlight = React.useRef(false);

  const agentFields = React.useMemo(() => chosen?.placeholders.filter((p) => p.kind === 'AGENT') ?? [], [chosen]);

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(
      () => {
        listTemplates(t, ws, { status: 'ACTIVE', q: search.trim() }).then(
          (items) => {
            if (!live) return;
            setTemplates(items);
            setLoading(false);
          },
          (e) => {
            if (!live) return;
            setTemplates([]);
            setLoading(false);
            setError(messageFor(e));
          },
        );
      },
      search === '' ? 0 : DEBOUNCE_MS,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search, t, ws]);

  React.useEffect(() => {
    if (!chosen) return undefined;
    let live = true;
    setRendering(true);
    const timer = setTimeout(() => {
      renderTemplate(t, ws, chosen.id, {
        contactId: chat.contact.id,
        values: Object.fromEntries(agentFields.map((p) => [p.name, values[p.name] ?? ''])),
      }).then(
        (r) => {
          if (!live) return;
          setResult(r);
          setRendering(false);
        },
        (e) => {
          if (!live) return;
          setResult(null);
          setRendering(false);
          setError(messageFor(e));
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [chosen, agentFields, values, chat.contact.id, t, ws]);

  const choose = async (id: string) => {
    setOpening(true);
    setError(null);
    try {
      const full = await getTemplate(t, ws, id);
      setValues(
        Object.fromEntries(full.placeholders.filter((p) => p.kind === 'AGENT').map((p) => [p.name, p.example ?? ''])),
      );
      setFieldErrors({});
      setResult(null);
      setChosen(full);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setOpening(false);
    }
  };

  const missing = result?.missing ?? [];
  const canSend = chosen !== null && result !== null && missing.length === 0 && !rendering && !sending;

  const send = async () => {
    if (!chosen || !canSend || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    setFieldErrors({});
    try {
      const message = await sendTemplate(
        t,
        ws,
        chat.id,
        chosen.id,
        Object.fromEntries(agentFields.map((p) => [p.name, values[p.name] ?? ''])),
      );
      onSent(message);
    } catch (e) {
      const fields = e instanceof ApiError && e.code?.toUpperCase() === 'VALIDATION' ? e.fields : undefined;
      const known = Object.fromEntries(
        Object.entries(fields ?? {}).filter(([k]) => agentFields.some((p) => p.name === k)),
      );
      if (Object.keys(known).length > 0) setFieldErrors(known);
      else setError(messageFor(e));
      inFlight.current = false;
      setSending(false);
    }
  };

  const fieldError = (p: PlaceholderView) => fieldErrors[p.name] ?? (missing.includes(p.name) ? 'Required' : undefined);
  const otherMissing = missing.filter((name) => !agentFields.some((p) => p.name === name));

  return (
    <Modal isOpen variant="large" onClose={onClose} aria-labelledby="template-picker-title">
      <ModalHeader title="Send a template" labelId="template-picker-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--lg)', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 40%', minWidth: 0 }}>
            <SearchInput
              aria-label="Search templates"
              placeholder="Search templates"
              value={search}
              onChange={(_e, v) => setSearch(v)}
              onClear={() => setSearch('')}
            />
            {loading && <Spinner size="md" aria-label="Loading templates" />}
            {!loading && templates.length === 0 && <p>No templates found</p>}
            {templates.length > 0 && (
              <Menu aria-label="Templates" isPlain activeItemId={chosen?.id}>
                <MenuContent>
                  <MenuList>
                    {templates.map((tpl) => {
                      const unsupported = tpl.type === 'CONTACT_CARD';
                      return (
                        <MenuItem
                          key={tpl.id}
                          itemId={tpl.id}
                          isDisabled={unsupported}
                          isSelected={chosen?.id === tpl.id}
                          description={unsupported ? 'Not sendable from the inbox yet' : TYPE_META[tpl.type].label}
                          onClick={() => void choose(tpl.id)}
                        >
                          {tpl.name}
                          {unsupported ? ` (${TYPE_META[tpl.type].label})` : ''}
                        </MenuItem>
                      );
                    })}
                  </MenuList>
                </MenuContent>
              </Menu>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {opening && <Spinner size="md" aria-label="Loading template" />}
            {!chosen && !opening && <p>Pick a template to preview it.</p>}
            {chosen && (
              <>
                <Form onSubmit={(e) => e.preventDefault()}>
                  {agentFields.map((p) => {
                    const err = fieldError(p);
                    return (
                      <FormGroup
                        key={p.name}
                        label={labelOf(p)}
                        fieldId={`template-value-${p.name}`}
                        isRequired={p.required}
                      >
                        <TextInput
                          id={`template-value-${p.name}`}
                          value={values[p.name] ?? ''}
                          validated={err ? 'error' : 'default'}
                          onChange={(_e, v) => {
                            setValues((all) => ({ ...all, [p.name]: v }));
                            setFieldErrors((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== p.name)));
                          }}
                        />
                        {(err || p.example) && (
                          <FormHelperText>
                            <HelperText>
                              {err ? (
                                <HelperTextItem variant="error">{err}</HelperTextItem>
                              ) : (
                                <HelperTextItem>{p.example}</HelperTextItem>
                              )}
                            </HelperText>
                          </FormHelperText>
                        )}
                      </FormGroup>
                    );
                  })}
                </Form>
                {otherMissing.length > 0 && (
                  <Alert variant="warning" isInline isPlain title={`Missing: ${otherMissing.join(', ')}`} />
                )}
                {result?.warnings.map((w) => <Alert key={w} variant="warning" isInline isPlain title={w} />)}
                {result ? (
                  <div style={{ marginTop: 16, opacity: rendering ? 0.6 : 1 }}>
                    <TemplateBubble
                      label={chosen.name}
                      type={result.type}
                      content={result.content}
                      media={result.media}
                    />
                  </div>
                ) : (
                  rendering && <Spinner size="md" aria-label="Rendering preview" />
                )}
              </>
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={() => void send()} isDisabled={!canSend}>
          Send
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
