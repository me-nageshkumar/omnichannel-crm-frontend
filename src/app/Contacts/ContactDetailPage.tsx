import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Title,
} from '@patternfly/react-core';
import {
  addContactLabel,
  deleteContact,
  getContact,
  listAttributes,
  listLabels,
  removeContactLabel,
  updateContact,
} from '@app/api/contacts';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { EditContactModal } from '@app/Contacts/EditContactModal';
import { LabelChip } from '@app/Contacts/LabelChip';
import { NotesPanel } from '@app/Contacts/NotesPanel';
import { SOURCE_TEXT, displayName, phoneText } from '@app/Contacts/contactDisplay';

const when = (iso: string | null) => (iso ? relative(iso) : '—');

/** One contact: details, labels, attributes and notes. */
export const ContactDetailPage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const navigate = useNavigate();
  const access = useAccess();
  const canAnnotate = access.hasInWorkspace('contact:annotate');
  const canEdit = access.hasInWorkspace('contact:edit');
  const canDelete = access.hasInWorkspace('contact:delete');
  const contact = useLoad((tk) => getContact(tk, ws, id), [ws, id]);
  const labels = useLoad((tk) => listLabels(tk, ws), [ws]);
  const attributes = useLoad((tk) => listAttributes(tk, ws), [ws]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const tagging = useAction();
  const removal = useAction();

  const c = contact.data;
  const mine = new Set(c?.labels ?? []);
  const attached = (labels.data ?? []).filter((l) => mine.has(l.id));
  const available = (labels.data ?? []).filter((l) => !mine.has(l.id));

  const tag = async (labelId: string, add: boolean) => {
    const updated = await tagging.run(() =>
      add ? addContactLabel(t, ws, id, labelId) : removeContactLabel(t, ws, id, labelId),
    );
    if (updated) contact.setData(() => updated);
  };
  const onDelete = async () => {
    const done = await removal.run(async () => {
      await deleteContact(t, ws, id);
      return true;
    });
    if (done) navigate('/contacts');
  };

  return (
    <PageShell
      title={c ? displayName(c) : 'Contact'}
      actions={
        c && (
          <>
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}{' '}
            {canDelete && (
              <Button
                variant="danger"
                onClick={() => {
                  removal.reset();
                  setDeleting(true);
                }}
              >
                Delete contact
              </Button>
            )}
          </>
        )
      }
    >
      <Link to="/contacts">Back to contacts</Link>
      {contact.error && <Alert variant="danger" isInline title={contact.error} />}
      {contact.loading && !c ? (
        <Spinner aria-label="Loading contact" />
      ) : (
        c && (
          <>
            <DescriptionList isHorizontal isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>Phone</DescriptionListTerm>
                <DescriptionListDescription>{phoneText(c)}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Source</DescriptionListTerm>
                <DescriptionListDescription>{SOURCE_TEXT[c.source]}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Created</DescriptionListTerm>
                <DescriptionListDescription>{when(c.creationTime)}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Last message</DescriptionListTerm>
                <DescriptionListDescription>{when(c.lastMessageAt)}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>

            <Title headingLevel="h2" size="md">
              Labels
            </Title>
            {tagging.error && <Alert variant="danger" isInline isPlain title={tagging.error} />}
            <div>
              {attached.map((l) => (
                <LabelChip key={l.id} label={l} onClose={canAnnotate ? () => tag(l.id, false) : undefined} />
              ))}
              {attached.length === 0 && 'No labels.'}
              {canAnnotate && available.length > 0 && (
                <Select
                  isOpen={addOpen}
                  onSelect={(_e, v) => {
                    setAddOpen(false);
                    tag(v as string, true);
                  }}
                  onOpenChange={setAddOpen}
                  toggle={(ref) => (
                    <MenuToggle ref={ref} isExpanded={addOpen} onClick={() => setAddOpen(!addOpen)}>
                      Add label
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    {available.map((l) => (
                      <SelectOption key={l.id} value={l.id}>
                        {l.name}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              )}
            </div>

            <Title headingLevel="h2" size="md">
              Attributes
            </Title>
            <DescriptionList isHorizontal isCompact aria-label="Attributes">
              {(attributes.data ?? []).map((a) => (
                <DescriptionListGroup key={a.id}>
                  <DescriptionListTerm>{a.name}</DescriptionListTerm>
                  <DescriptionListDescription>{c.attributes[a.id] ?? '—'}</DescriptionListDescription>
                </DescriptionListGroup>
              ))}
            </DescriptionList>

            <NotesPanel token={t} workspaceId={ws} contactId={id} canAnnotate={canAnnotate} canDeleteAny={canDelete} />

            {editing && (
              <EditContactModal
                contact={c}
                attributes={attributes.data ?? []}
                save={(changes) => updateContact(t, ws, id, changes)}
                onSaved={(saved) => {
                  contact.setData(() => saved);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            )}
            {deleting && (
              <ConfirmModal
                title="Delete this contact?"
                confirmLabel="Delete"
                variant="danger"
                busy={removal.busy}
                error={removal.error}
                onConfirm={onDelete}
                onCancel={() => setDeleting(false)}
              >
                {`Delete ${displayName(c)}? Their notes are deleted too. This cannot be undone.`}
              </ConfirmModal>
            )}
          </>
        )
      )}
    </PageShell>
  );
};
