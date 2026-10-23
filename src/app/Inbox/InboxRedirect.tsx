import * as React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { writeInboxFilter } from '@app/Inbox/inboxFilterStore';
import { useSession } from '@app/session/SessionContext';

/** The old per-number inbox URLs: the number becomes the filter, the chat (if any) stays open. */
export const InboxRedirect: React.FunctionComponent = () => {
  const { phoneNumberId = '', chatId } = useParams();
  const { user, workspace } = useSession();
  if (user && workspace && phoneNumberId) writeInboxFilter(user.id, workspace.id, [phoneNumberId]);
  return <Navigate to={chatId ? `/inbox/chats/${encodeURIComponent(chatId)}` : '/inbox'} replace />;
};
