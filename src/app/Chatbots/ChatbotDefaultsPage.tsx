import * as React from 'react';
import { Alert, Content, Spinner } from '@patternfly/react-core';
import { getPlatformChatbotSettings, savePlatformChatbotSettings } from '@app/api/chatbots';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { LayerEditor } from '@app/Chatbots/settings/LayerEditor';
import { useSession } from '@app/session/SessionContext';

/** The chatbot settings every brand starts with (spec 2026-11-14 §8), for the super admin. */
export const ChatbotDefaultsPage: React.FunctionComponent = () => {
  const { token } = useSession();
  const loaded = useLoad((tk) => getPlatformChatbotSettings(tk), []);
  const data = loaded.data;
  return (
    <PageShell title="Chatbot defaults">
      <Content component="p">Every brand uses these until it sets its own.</Content>
      {loaded.error && <Alert variant="danger" isInline title={loaded.error} />}
      {!data && !loaded.error && <Spinner aria-label="Loading settings" />}
      {data && (
        <LayerEditor
          key={String(data.version)}
          loaded={data.settings}
          version={data.version}
          inherited={null}
          sources={{}}
          readOnly={false}
          errorPrefix="settings"
          reload={loaded.reload}
          save={async (settings, version) => {
            const reply = await savePlatformChatbotSettings(token as string, { settings, version });
            return { layer: reply.settings, version: reply.version };
          }}
        />
      )}
    </PageShell>
  );
};
