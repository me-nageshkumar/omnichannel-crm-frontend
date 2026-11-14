import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Content, Spinner } from '@patternfly/react-core';
import { getBrandChatbotSettings, saveBrandChatbotSettings } from '@app/api/chatbots';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { LayerEditor } from '@app/Chatbots/settings/LayerEditor';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

/** The brand's own chatbot settings (spec 2026-11-14 §8): empty fields follow the platform defaults. */
export const ChatbotSettingsPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('chatbot:manage');
  const loaded = useLoad((tk) => getBrandChatbotSettings(tk, ws), [ws]);
  const data = loaded.data;
  return (
    <PageShell
      title="Chatbot settings"
      actions={
        <Button component={(p) => <Link {...p} to="/chatbots" />} variant="link">
          Back to chatbots
        </Button>
      }
    >
      <Content component="p">
        Your chatbots use these unless a chatbot sets its own. Empty fields follow the platform default.
      </Content>
      {loaded.error && <Alert variant="danger" isInline title={loaded.error} />}
      {!data && !loaded.error && <Spinner aria-label="Loading settings" />}
      {data && (
        <LayerEditor
          key={`${ws}:${data.version}`}
          loaded={data.own}
          version={data.version}
          inherited={data.inherited}
          sources={{}}
          readOnly={!canManage}
          errorPrefix="own"
          reload={loaded.reload}
          save={async (own, version) => {
            const reply = await saveBrandChatbotSettings(token as string, ws, { own, version });
            return { layer: reply.own, version: reply.version };
          }}
        />
      )}
    </PageShell>
  );
};
