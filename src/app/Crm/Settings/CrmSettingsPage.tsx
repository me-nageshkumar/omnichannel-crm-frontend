import * as React from 'react';
import { Alert, Tab, TabTitleText, Tabs } from '@patternfly/react-core';
import { PageShell } from '@app/admin/PageShell';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';
import { GeneralSettings } from '@app/Crm/Settings/GeneralSettings';
import { PipelinesSettings } from '@app/Crm/Settings/PipelinesSettings';
import { FieldsSettings } from '@app/Crm/Settings/FieldsSettings';
import { PicklistsSettings } from '@app/Crm/Settings/PicklistsSettings';

/** Brand-level CRM settings: general, pipelines, custom fields and picklists. */
export const CrmSettingsPage: React.FunctionComponent = () => {
  const canManage = useCrmCan('crm:settings');
  const [tab, setTab] = React.useState<string | number>('general');
  return (
    <PageShell title="CRM settings">
      {!canManage && (
        <Alert
          variant="info"
          isInline
          title="You can view these settings. Changing them needs the CRM settings permission."
          className="pf-v6-u-mb-md"
        />
      )}
      <Tabs activeKey={tab} onSelect={(_e, key) => setTab(key)} aria-label="CRM settings" mountOnEnter unmountOnExit>
        <Tab eventKey="general" title={<TabTitleText>General</TabTitleText>}>
          <GeneralSettings canManage={canManage} />
        </Tab>
        <Tab eventKey="pipelines" title={<TabTitleText>Pipelines</TabTitleText>}>
          <PipelinesSettings canManage={canManage} />
        </Tab>
        <Tab eventKey="fields" title={<TabTitleText>Fields</TabTitleText>}>
          <FieldsSettings canManage={canManage} />
        </Tab>
        <Tab eventKey="picklists" title={<TabTitleText>Picklists</TabTitleText>}>
          <PicklistsSettings canManage={canManage} />
        </Tab>
      </Tabs>
    </PageShell>
  );
};
