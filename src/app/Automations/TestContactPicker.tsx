import * as React from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Radio,
  SearchInput,
  Spinner,
  Switch,
  TextInput,
} from '@patternfly/react-core';
import { searchTestContacts } from '@app/api/automations';
import type { EventKind, TestContact, TestStartRequest } from '@app/api/automations';
import { messageFor } from '@app/api/messages';
import { NUMBER_PATTERN, normaliseNumber } from '@app/api/phoneNumbers';
import { useSession } from '@app/session/SessionContext';

export const SEARCH_DEBOUNCE_MS = 300;
export const TYPED_NUMBER_HELP =
  'A number WhatsApp hides cannot be typed; choose the contact and switch on “Treat this chat as new”.';

/** "Asha · +919811100001 · on Main line"; a phone WhatsApp hides reads "Number hidden". */
export function contactLine(c: TestContact): string {
  const parts = [c.name ?? 'No name', c.phone ? `+${c.phone}` : 'Number hidden'];
  if (c.numbers.length > 0) parts.push(`on ${c.numbers.map((n) => n.label ?? `+${n.number}`).join(', ')}`);
  return parts.join(' · ');
}

/**
 * Who the test listens to: an existing contact found by search, or (message rules only) a number that has never
 * written in. {@code preflight} is shown above Start test, which stays disabled while {@code canStart} is false.
 */
export const TestContactPicker: React.FunctionComponent<{
  event: EventKind;
  canStart: boolean;
  busy: boolean;
  preflight?: React.ReactNode;
  onStart(body: TestStartRequest): void;
}> = ({ event, canStart, busy, preflight, onStart }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const messages = event === 'MESSAGE_RECEIVED';
  const [typed, setTyped] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [found, setFound] = React.useState<TestContact[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [contactId, setContactId] = React.useState<string | null>(null);
  const [phone, setPhone] = React.useState('');
  const [treatAsNew, setTreatAsNew] = React.useState(false);
  const latest = React.useRef(0);

  const text = q.trim();
  React.useEffect(() => {
    const request = ++latest.current;
    if (!token || text === '') {
      setFound(null);
      setSearching(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchTestContacts(token, ws, text).then(
        (list) => {
          if (request !== latest.current) return;
          setFound(list);
          setSearching(false);
        },
        (e) => {
          if (request !== latest.current) return;
          setSearchError(messageFor(e));
          setSearching(false);
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      latest.current += 1;
    };
  }, [text, token, ws]);

  const byNumber = messages && typed;
  const digits = normaliseNumber(phone.trim());
  const phoneValid = NUMBER_PATTERN.test(digits);
  const chosen = byNumber ? phoneValid : contactId !== null;

  const start = () =>
    onStart({
      contactId: byNumber ? null : contactId,
      phone: byNumber ? digits : null,
      treatAsNew: messages && treatAsNew,
    });

  const search = (
    <>
      <SearchInput
        aria-label="Search contacts"
        placeholder="Name or number"
        value={q}
        onChange={(_e, v) => setQ(v)}
        onClear={() => setQ('')}
      />
      {searching && <Spinner size="md" aria-label="Searching contacts" />}
      {searchError && <Alert variant="danger" isInline title={searchError} />}
      {found && !searching && found.length === 0 && (
        <HelperText>
          <HelperTextItem>No contacts match.</HelperTextItem>
        </HelperText>
      )}
      {found &&
        found.map((c) => (
          <Radio
            key={c.contactId}
            id={`test-contact-${c.contactId}`}
            name="test-contact"
            label={contactLine(c)}
            isChecked={contactId === c.contactId}
            onChange={() => setContactId(c.contactId)}
          />
        ))}
    </>
  );

  return (
    <Form onSubmit={(e) => e.preventDefault()} style={{ maxWidth: '48rem' }}>
      {messages ? (
        <FormGroup role="radiogroup" isStack fieldId="test-contact-kind" label="Test contact">
          <Radio
            id="test-contact-existing"
            name="test-contact-kind"
            label="An existing contact"
            isChecked={!typed}
            onChange={() => setTyped(false)}
            body={!typed && search}
          />
          <Radio
            id="test-contact-number"
            name="test-contact-kind"
            label="A number that has never messaged you"
            isChecked={typed}
            onChange={() => setTyped(true)}
            body={
              typed && (
                <FormGroup label="Phone number, country code first" fieldId="test-contact-phone">
                  <TextInput
                    id="test-contact-phone"
                    type="tel"
                    value={phone}
                    validated={phone.trim() !== '' && !phoneValid ? 'error' : 'default'}
                    onChange={(_e, v) => setPhone(v)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{TYPED_NUMBER_HELP}</HelperTextItem>
                      {phone.trim() !== '' && !phoneValid && (
                        <HelperTextItem variant="error">
                          Enter the number with its country code, e.g. +91 98111 00009.
                        </HelperTextItem>
                      )}
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              )
            }
          />
        </FormGroup>
      ) : (
        <FormGroup label="Test contact" isStack fieldId="test-contact-search">
          {search}
        </FormGroup>
      )}
      {messages && (
        <Switch
          id="test-treat-as-new"
          label="Treat this chat as new"
          isChecked={treatAsNew}
          onChange={(_e, on) => setTreatAsNew(on)}
        />
      )}
      {preflight}
      <ActionGroup>
        <Button variant="primary" isDisabled={!canStart || !chosen || busy} isLoading={busy} onClick={start}>
          Start test
        </Button>
      </ActionGroup>
    </Form>
  );
};
