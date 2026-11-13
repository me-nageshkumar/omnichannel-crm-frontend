import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Chatbot } from '@app/api/chatbots';
import { createChatbot } from '@app/api/chatbots';
import { NameModal } from '@app/admin/NameModal';
import { useSession } from '@app/session/SessionContext';

/** Names a new chatbot, creates it as a draft and opens its editor. */
export const NewChatbotModal: React.FunctionComponent<{ onCancel(): void }> = ({ onCancel }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  return (
    <NameModal<Chatbot>
      title="New chatbot"
      submitLabel="Create"
      save={(name) => createChatbot(token as string, ws, name)}
      onSaved={(bot) => navigate(`/chatbots/${bot.id}`)}
      onCancel={onCancel}
    />
  );
};
