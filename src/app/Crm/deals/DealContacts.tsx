import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertActionCloseButton, Button, Label, Spinner } from '@patternfly/react-core';
import { dealContacts } from '@app/api/crm';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useOpenChat } from '@app/Crm/deals/useOpenChat';

/** The people on a deal, primary first, each with their own chat; the deal form changes who is on it. */
export const DealContacts: React.FunctionComponent<{ dealId: string }> = ({ dealId }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad((t) => dealContacts(t, ws, dealId), [ws, dealId]);
  const chat = useOpenChat();
  if (loaded.error) return <Alert variant="danger" isInline title={loaded.error} />;
  if (!loaded.data) return <Spinner aria-label="Loading contacts" />;
  if (loaded.data.length === 0) return <p className="pf-v6-u-color-200">No contacts on this deal.</p>;
  return (
    <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}>
      {chat.alert && (
        <Alert
          variant="warning"
          isInline
          title={chat.alert}
          actionClose={<AlertActionCloseButton onClose={chat.clearAlert} />}
        />
      )}
      <ul
        aria-label="Contacts on this deal"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}
      >
        {loaded.data.map((c) => {
          const name = c.name || c.phone || 'Contact';
          const details = [c.phone !== name ? c.phone : null, c.jobTitle].filter(Boolean).join(' · ');
          return (
            <li
              key={c.id}
              style={{
                display: 'flex',
                gap: 'var(--pf-t--global--spacer--sm)',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <Link to={`/crm/contacts/${encodeURIComponent(c.id)}`}>{name}</Link>{' '}
                {c.primary && (
                  <Label isCompact color="blue">
                    Primary
                  </Label>
                )}
                {details && <div style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>{details}</div>}
              </div>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Open chat with ${name}`}
                isDisabled={chat.busy}
                onClick={() => void chat.openChat(c.id)}
              >
                Open chat
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
