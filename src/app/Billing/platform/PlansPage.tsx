import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tab, Tabs, TabTitleText } from '@patternfly/react-core';
import { PageShell } from '@app/admin/PageShell';
import { FeatureGroupsTab } from '@app/Billing/platform/FeatureGroupsTab';
import { PlansTab } from '@app/Billing/platform/PlansTab';

type TabKey = 'plans' | 'groups';

/** Platform staff: the plans customers are put on, and the feature groups plans are made of. */
export const PlansPage: React.FunctionComponent = () => {
  const [params, setParams] = useSearchParams();
  const tab: TabKey = params.get('tab') === 'groups' ? 'groups' : 'plans';
  return (
    <PageShell title="Plans">
      <Tabs
        activeKey={tab}
        onSelect={(_e, key) => setParams(key === 'groups' ? { tab: 'groups' } : {}, { replace: true })}
        aria-label="Plans and feature groups"
        mountOnEnter
        unmountOnExit
      >
        <Tab eventKey="plans" title={<TabTitleText>Plans</TabTitleText>} aria-label="Plans">
          <PlansTab />
        </Tab>
        <Tab eventKey="groups" title={<TabTitleText>Feature groups</TabTitleText>} aria-label="Feature groups">
          <FeatureGroupsTab />
        </Tab>
      </Tabs>
    </PageShell>
  );
};
