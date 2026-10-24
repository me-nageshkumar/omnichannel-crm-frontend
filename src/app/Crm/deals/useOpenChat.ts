import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { getCommunication } from '@app/api/crm';
import { crmMessage } from '@app/Crm/errors';
import { useSession } from '@app/session/SessionContext';

export const CANNOT_CHAT = "You don't work this WhatsApp number, so the inbox won't open this chat.";

/**
 * {@code openChat(crmContactId, phoneNumberId?)} opens the contact's chat in the inbox, or the new-chat dialog
 * pre-filled when there is none; {@code alert} holds the reason it could not.
 */
export function useOpenChat() {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  const [alert, setAlert] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const openChat = async (crmContactId: string, phoneNumberId?: string) => {
    setAlert(null);
    setBusy(true);
    try {
      const c = await getCommunication(token as string, ws, crmContactId, phoneNumberId);
      if (c.chatId) navigate(`/inbox/chats/${encodeURIComponent(c.chatId)}`);
      else if (c.canChat)
        navigate(`/inbox?newChat=${encodeURIComponent(c.phoneNumberId)}&phone=${encodeURIComponent(c.phone)}`);
      else setAlert(CANNOT_CHAT);
    } catch (e) {
      setAlert(crmMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { openChat, alert, busy, clearAlert: () => setAlert(null) };
}
