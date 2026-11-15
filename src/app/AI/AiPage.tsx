import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Spinner, Tab, TabTitleText, Tabs } from '@patternfly/react-core';
import { listAiProviders } from '@app/api/ai';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { ConnectionsTab } from '@app/AI/ConnectionsTab';

/** Brand setup → AI (spec 2026-11-15 §5.10): provider connections and AI profiles. */
export const AiPage: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('ai:manage');
  const providers = useLoad((tk) => listAiProviders(tk, ws), [ws]);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'profiles' ? 'profiles' : 'connections';
  return (
    <PageShell title="AI">
      {providers.error && <Alert variant="danger" isInline title={providers.error} />}
      {!providers.data && !providers.error && <Spinner aria-label="Loading providers" />}
      {providers.data && (
        <Tabs
          activeKey={tab}
          onSelect={(_e, key) => setParams(key === 'profiles' ? { tab: 'profiles' } : {}, { replace: true })}
          aria-label="AI"
          mountOnEnter
          unmountOnExit
        >
          <Tab eventKey="connections" title={<TabTitleText>Connections</TabTitleText>}>
            <ConnectionsTab providers={providers.data} canManage={canManage} />
          </Tab>
        </Tabs>
      )}
    </PageShell>
  );
};
