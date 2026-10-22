import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { CampaignStatus } from '@app/api/campaigns';

const META: Record<CampaignStatus, { text: string; color: 'grey' | 'blue' | 'orange' | 'green' | 'red' }> = {
  DRAFT: { text: 'Draft', color: 'grey' },
  RUNNING: { text: 'Running', color: 'blue' },
  PAUSED: { text: 'Paused', color: 'orange' },
  COMPLETED: { text: 'Completed', color: 'green' },
  TERMINATED: { text: 'Terminated', color: 'red' },
};

/** A campaign's status as a coloured label. */
export const CampaignStatusLabel: React.FunctionComponent<{ status: CampaignStatus }> = ({ status }) => (
  <Label color={META[status].color}>{META[status].text}</Label>
);
