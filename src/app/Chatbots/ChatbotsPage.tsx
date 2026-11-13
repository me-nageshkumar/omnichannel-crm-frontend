import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  Label,
  MenuToggle,
  Spinner,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { ChatbotSummary } from '@app/api/chatbots';
import { deleteChatbot, listChatbots } from '@app/api/chatbots';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { statusColor, statusLabel } from '@app/Chatbots/chatbotDisplay';
import { NewChatbotModal } from '@app/Chatbots/NewChatbotModal';

export const EMPTY_TEXT =
  'No chatbots yet. A chatbot walks a contact through a flow of messages and questions; an automation rule starts it.';

type Item = { key: string; label: string; to?: string; run?: () => void };

const RowActions: React.FunctionComponent<{ bot: ChatbotSummary; items: Item[] }> = ({ bot, items }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={() => setOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          variant="plain"
          aria-label={`Actions for ${bot.name}`}
          isExpanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
    >
      <DropdownList>
        {items.map((i) =>
          i.to ? (
            <DropdownItem key={i.key} component={(props) => <Link {...props} to={i.to as string} />}>
              {i.label}
            </DropdownItem>
          ) : (
            <DropdownItem key={i.key} onClick={i.run}>
              {i.label}
            </DropdownItem>
          ),
        )}
      </DropdownList>
    </Dropdown>
  );
};

/** The brand's chatbots (spec §8.1). */
export const ChatbotsPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('chatbot:manage');
  const list = useLoad((tk) => listChatbots(tk, ws), [ws]);
  const confirm = useAction();
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ChatbotSummary | null>(null);

  const remove = async () => {
    if (!deleting || !token) return;
    const done = await confirm.run(() => deleteChatbot(token, ws, deleting.id).then(() => true));
    if (done) {
      setDeleting(null);
      list.reload();
    }
  };

  const itemsFor = (b: ChatbotSummary): Item[] => {
    const items: Item[] = [{ key: 'edit', label: canManage ? 'Edit' : 'Open', to: `/chatbots/${b.id}` }];
    items.push({ key: 'runs', label: 'Runs', to: `/chatbots/${b.id}/runs` });
    if (canManage && b.status === 'DRAFT') {
      items.push({
        key: 'delete',
        label: 'Delete',
        run: () => {
          confirm.reset();
          setDeleting(b);
        },
      });
    }
    return items;
  };

  let body: React.ReactNode;
  if (list.error) body = <Alert variant="danger" isInline title={list.error} />;
  else if (!list.data) body = <Spinner aria-label="Loading chatbots" />;
  else if (list.data.length === 0) body = <EmptyState headingLevel="h2" titleText={EMPTY_TEXT} />;
  else
    body = (
      <Table aria-label="Chatbots" variant="compact">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Runs (7 days)</Th>
            <Th>Active now</Th>
            <Th>Last run</Th>
            <Th>Updated</Th>
            <Th screenReaderText="Actions" />
          </Tr>
        </Thead>
        <Tbody>
          {list.data.map((b) => (
            <Tr key={b.id}>
              <Td dataLabel="Name">
                <Link to={`/chatbots/${b.id}`}>{b.name}</Link>
              </Td>
              <Td dataLabel="Status">
                <Label isCompact color={statusColor(b.status)}>
                  {statusLabel(b.status)}
                </Label>
              </Td>
              <Td dataLabel="Runs (7 days)">{b.runs7d}</Td>
              <Td dataLabel="Active now">{b.activeNow}</Td>
              <Td dataLabel="Last run">{b.lastRunAt ? relative(b.lastRunAt) : 'Never'}</Td>
              <Td dataLabel="Updated">{relative(b.lastUpdateTime)}</Td>
              <Td isActionCell>
                <RowActions bot={b} items={itemsFor(b)} />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    );

  return (
    <PageShell
      title="Chatbots"
      actions={
        canManage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            New chatbot
          </Button>
        )
      }
    >
      {body}
      {creating && <NewChatbotModal onCancel={() => setCreating(false)} />}
      {deleting && (
        <ConfirmModal
          title="Delete chatbot"
          confirmLabel="Delete"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        >
          Delete “{deleting.name}”? Its runs stay in the history; the flow and its versions are removed.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
