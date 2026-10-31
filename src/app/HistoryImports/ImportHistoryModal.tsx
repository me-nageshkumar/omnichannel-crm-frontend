import * as React from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Radio,
  TextArea,
} from '@patternfly/react-core';
import { HistoryImportView, startChatImport, startNumberImport } from '@app/api/historyImports';
import type { ChatView } from '@app/api/inbox';
import { PhoneNumber, shown } from '@app/api/phoneNumbers';
import { useAction } from '@app/admin/useAction';
import { contactName } from '@app/Inbox/chatDisplay';
import { useSession } from '@app/session/SessionContext';
import { dayEnd, dayStart, isValidDay, parsePhones, validateRange } from './importForm';

type Target = { kind: 'number'; number: PhoneNumber } | { kind: 'chat'; chat: ChatView };

const helper = (text: string | null | undefined) =>
  text && (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{text}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  );

/**
 * Where a date picker draws its calendar. The dialog body scrolls and is shorter than a calendar: drawn inside it, the
 * popup scrolls its own field out of view and PatternFly then hides it.
 */
const calendarHost = () => document.body;

/** Asks which chats and which days to import, then queues the import. Callers decide who may see it. */
export const ImportHistoryModal: React.FunctionComponent<{
  target: Target;
  onStarted(imp: HistoryImportView): void;
  onCancel(): void;
}> = ({ target, onStarted, onCancel }) => {
  const { token, workspace } = useSession();
  const [specific, setSpecific] = React.useState(false);
  const [text, setText] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [fromError, setFromError] = React.useState<string | null>(null);
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  const [phonesError, setPhonesError] = React.useState<string | null>(null);
  const action = useAction();
  const number = target.kind === 'number';
  const title =
    'Import chat history' +
    (target.kind === 'number' ? ` for ${shown(target.number.number)}` : ` with ${contactName(target.chat)}`);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const badDate = 'Enter a date as YYYY-MM-DD.';
    const badFrom = from && !isValidDay(from) ? badDate : null;
    const badTo = to && !isValidDay(to) ? badDate : null;
    const range = badTo ?? validateRange(from, to);
    setFromError(badFrom);
    const { phones, invalid } = parsePhones(text);
    let phoneProblem: string | null = null;
    if (target.kind === 'number' && specific) {
      if (invalid.length > 0) phoneProblem = `Use 8 to 15 digits, country code first: ${invalid.join(', ')}`;
      else if (phones.length === 0) phoneProblem = 'Enter at least one phone number.';
    }
    setRangeError(range);
    setPhonesError(phoneProblem);
    if (badFrom || range || phoneProblem || !workspace) return;
    const dates = { from: from ? dayStart(from) : null, to: to ? dayEnd(to) : null };
    const started = await action.run(() =>
      target.kind === 'number'
        ? startNumberImport(token as string, workspace.id, target.number.id, {
            scope: specific ? { kind: 'CHATS', phones } : { kind: 'ALL' },
            ...dates,
          })
        : startChatImport(token as string, workspace.id, target.chat.id, dates),
    );
    if (started) onStarted(started);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="import-history-title">
      <ModalHeader title={title} labelId="import-history-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="import-history-form" onSubmit={onSubmit}>
          {number && (
            <FormGroup role="radiogroup" isInline label="Import" fieldId="import-scope">
              <Radio
                id="import-all"
                name="import-scope"
                label="All chats"
                isChecked={!specific}
                onChange={() => setSpecific(false)}
              />
              <Radio
                id="import-specific"
                name="import-scope"
                label="Specific contacts"
                isChecked={specific}
                onChange={() => setSpecific(true)}
              />
            </FormGroup>
          )}
          {number && specific && (
            <FormGroup fieldId="import-phones">
              <TextArea
                id="import-phones"
                aria-label="Phone numbers"
                placeholder="One number per line, country code first"
                value={text}
                onChange={(_e, v) => setText(v)}
                validated={phonesError ? 'error' : 'default'}
              />
              {helper(phonesError)}
            </FormGroup>
          )}
          <FormGroup label="From" fieldId="import-from">
            <DatePicker aria-label="From" value={from} onChange={(_e, v) => setFrom(v)} appendTo={calendarHost} />
            {helper(fromError)}
          </FormGroup>
          <FormGroup label="To" fieldId="import-to">
            <DatePicker aria-label="To" value={to} onChange={(_e, v) => setTo(v)} appendTo={calendarHost} />
            {helper(rangeError)}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="submit"
          form="import-history-form"
          variant="primary"
          isLoading={action.busy}
          isDisabled={action.busy}
        >
          Start import
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
