import * as React from 'react';
import {
  Alert,
  Button,
  Content,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@patternfly/react-core';
import { getCustomer } from '@app/api/customers';
import type { Workspace } from '@app/api/workspaces';
import { type MovePreview, type PhoneNumber, moveNumber, previewNumberMove, shown } from '@app/api/phoneNumbers';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

/** The move endpoints word their refusals for the person (campaigns to stop, Retry to finish): show that sentence. */
export function moveMessage(e: unknown): string {
  if (e instanceof ApiError && e.code && /^number_(move|moving|archived)/i.test(e.code) && e.serverMessage) {
    return e.serverMessage;
  }
  return messageFor(e);
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The lines of spec 2026-11-18 §7.1 for one preview. */
function previewLines(p: MovePreview, label: string): string[] {
  const lines = [`Its ${plural(p.chats, 'chat')} stay in ${p.fromWorkspaceName} as "${p.archiveLabel}", read only.`];
  if (p.movingBack) {
    lines.push(`The ${plural(p.returningChats, 'archived chat')} in ${p.toWorkspaceName} return to ${label}.`);
  } else {
    lines.push(`New chats start in ${p.toWorkspaceName}. The phone stays linked and reconnects in a few seconds.`);
  }
  const runs = p.activeRuns > 0 ? `${plural(p.activeRuns, 'unfinished chatbot run')} on this number end. ` : '';
  const team = p.teamName ? `Its team (${p.teamName}) is cleared; set one in the new brand.` : '';
  if (runs || team) lines.push(`${runs}${team}`.trim());
  return lines;
}

/** Platform → Phone numbers → Move to brand…: moves a number to another brand of its customer. */
export const MoveNumberModal: React.FunctionComponent<{
  number: PhoneNumber;
  onMoved(): void;
  onClose(): void;
}> = ({ number, onMoved, onClose }) => {
  const { token } = useSession();
  const t = token as string;
  const label = number.label ?? shown(number.number);
  const [brands, setBrands] = React.useState<Workspace[] | null>(null);
  const [target, setTarget] = React.useState('');
  const [preview, setPreview] = React.useState<MovePreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getCustomer(t, number.customerId).then(
      (c) => setBrands(c.workspaces.filter((w) => w.id !== number.workspaceId && !w.disabled)),
      (e: unknown) => setError(moveMessage(e)),
    );
  }, [t, number.customerId, number.workspaceId]);

  const choose = async (workspaceId: string) => {
    setTarget(workspaceId);
    setPreview(null);
    setError(null);
    if (!workspaceId) return;
    setLoading(true);
    try {
      setPreview(await previewNumberMove(t, number.id, workspaceId));
    } catch (e) {
      setError(moveMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      await moveNumber(t, number.id, target);
      onMoved();
    } catch (e) {
      setError(moveMessage(e));
      setBusy(false);
    }
  };

  const blocked = (preview?.activeCampaigns.length ?? 0) > 0;
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="move-number-title">
      <ModalHeader
        title={`Move ${label} (${shown(number.number)}) from ${number.workspaceName ?? 'its brand'}`}
        labelId="move-number-title"
      />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormGroup label="To brand" fieldId="move-number-brand">
            <FormSelect
              id="move-number-brand"
              value={target}
              onChange={(_e, v) => choose(v)}
              isDisabled={!brands || busy}
            >
              <FormSelectOption value="" label="Choose a brand" isPlaceholder />
              {(brands ?? []).map((w) => (
                <FormSelectOption key={w.id} value={w.id} label={w.name} />
              ))}
            </FormSelect>
          </FormGroup>
        </Form>
        {brands && brands.length === 0 && (
          <Content component="p">This company has no other brand to move the number to.</Content>
        )}
        {loading && <Spinner size="md" aria-label="Loading what the move does" />}
        {preview && (
          <>
            <List>
              {previewLines(preview, label).map((line) => (
                <ListItem key={line}>{line}</ListItem>
              ))}
            </List>
            {preview.rulesNamingNumber.length > 0 && (
              <Alert
                variant="warning"
                isInline
                isPlain
                title={`Rules in ${preview.fromWorkspaceName} that name this number: ${preview.rulesNamingNumber.join(', ')}`}
              />
            )}
            {blocked && (
              <Alert
                variant="danger"
                isInline
                isPlain
                title={`Stop these campaigns first: ${preview.activeCampaigns.join(', ')}`}
              />
            )}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button onClick={move} isDisabled={!preview || blocked || busy} isLoading={busy}>
          Move
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
