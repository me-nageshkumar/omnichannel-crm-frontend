import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Tab, TabTitleText, Tabs } from '@patternfly/react-core';
import { PageShell } from '@app/admin/PageShell';
import { useAccess } from '@app/session/useAccess';
import { RulesTab } from '@app/Automations/RulesTab';

/** The brand's automation rules, and (Task 7) the history of the events they saw. */
export const AutomationsPage: React.FunctionComponent = () => {
  const canManage = useAccess().hasInWorkspace('automation:manage');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'rules';
  return (
    <PageShell
      title="Automations"
      actions={
        canManage && (
          <Button variant="primary" component={(props) => <Link {...props} to="/automations/new" />}>
            New rule
          </Button>
        )
      }
    >
      <Tabs
        activeKey={tab}
        onSelect={(_e, k) => setParams(k === 'history' ? { tab: 'history' } : {})}
        aria-label="Automation views"
        mountOnEnter
      >
        <Tab eventKey="rules" title={<TabTitleText>Rules</TabTitleText>}>
          <RulesTab />
        </Tab>
        <Tab eventKey="history" title={<TabTitleText>Event history</TabTitleText>}>
          <div className="pf-v6-u-pt-md">The event history is coming soon.</div>
        </Tab>
      </Tabs>
    </PageShell>
  );
};
