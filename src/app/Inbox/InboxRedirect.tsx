import * as React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { NotFound } from '@app/NotFound/NotFound';
import { writeInboxFilter } from '@app/Inbox/inboxFilterStore';
import { useSession } from '@app/session/SessionContext';

/** The old per-number inbox URLs: the number becomes the filter, the chat (if any) stays open. */
export const InboxRedirect: React.FunctionComponent = () => {
  const { phoneNumberId = '', chatId } = useParams();
  const { user, workspace } = useSession();
  // a sibling page the user may not open falls through to this route: that is a 404, not a number
  if (phoneNumberId === 'routing' || phoneNumberId === 'chats') return <NotFound />;
  if (user && workspace && phoneNumberId) writeInboxFilter(user.id, workspace.id, [phoneNumberId]);
  return <Navigate to={chatId ? `/inbox/chats/${encodeURIComponent(chatId)}` : '/inbox'} replace />;
};
