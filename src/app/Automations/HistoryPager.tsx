import * as React from 'react';
import { Button, Flex, FlexItem } from '@patternfly/react-core';

/** The server's page size for runs and events. */
const PAGE_SIZE = 50;

/** "Newer" / "Older" paging over a zero-based, server-paged list. */
export const HistoryPager: React.FunctionComponent<{
  page: number;
  total: number;
  onPage: (page: number) => void;
}> = ({ page, total, onPage }) => (
  <Flex className="pf-v6-u-mt-md" gap={{ default: 'gapMd' }}>
    <FlexItem>
      <Button variant="secondary" isDisabled={page <= 0} onClick={() => onPage(page - 1)}>
        Newer
      </Button>
    </FlexItem>
    <FlexItem>
      <Button variant="secondary" isDisabled={(page + 1) * PAGE_SIZE >= total} onClick={() => onPage(page + 1)}>
        Older
      </Button>
    </FlexItem>
  </Flex>
);
