import * as React from 'react';
import { Alert, Button, Content, Flex, FlexItem, Progress } from '@patternfly/react-core';
import { CampaignProgress, REFRESH_SECONDS } from '@app/Campaigns/useCampaignProgress';

/**
 * While the campaign runs, a bar draining to the next fetch; otherwise when it was last fetched and
 * a Refresh button. The last fetch's failure shows beside it.
 */
export const RefreshCountdown: React.FunctionComponent<{ progress: CampaignProgress }> = ({ progress }) => {
  const { fetching, secondsLeft, refreshedAt, error, refresh } = progress;
  return (
    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }} style={{ minWidth: 200 }}>
      {secondsLeft !== null ? (
        <FlexItem>
          <Progress
            size="sm"
            measureLocation="none"
            title={fetching ? 'Refreshing…' : `Refreshing in ${secondsLeft} s`}
            value={fetching ? 100 : (secondsLeft * 100) / REFRESH_SECONDS}
          />
        </FlexItem>
      ) : (
        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
          {refreshedAt && (
            <FlexItem>
              <Content component="small">{`Refreshed ${refreshedAt.toLocaleTimeString()}`}</Content>
            </FlexItem>
          )}
          <FlexItem>
            <Button variant="secondary" size="sm" onClick={refresh}>
              Refresh
            </Button>
          </FlexItem>
        </Flex>
      )}
      {error && (
        <FlexItem>
          <Alert variant="danger" isInline isPlain title={error} />
        </FlexItem>
      )}
    </Flex>
  );
};
