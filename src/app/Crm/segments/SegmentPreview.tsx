import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  Spinner,
} from '@patternfly/react-core';
import { CommentIcon, FacebookIcon, InstagramIcon, SyncAltIcon, WhatsappIcon } from '@patternfly/react-icons';
import { previewSegment } from '@app/api/crm';
import type { ChannelKind, SegmentPreview as Preview, SegmentFieldCatalog, SegmentRuleGroup } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { useSession } from '@app/session/SessionContext';
import { crmMessage } from '@app/Crm/errors';
import { cleanRules, isComplete } from '@app/Crm/segments/segmentModel';

export const DEBOUNCE_MS = 600;
export const INCOMPLETE_TEXT = 'Finish the rules to see who matches';
export const TRUNCATED_TEXT = 'first 50,000 only — narrow the rules before sending';

const n = (v: number) => v.toLocaleString('en-US');

/** "n CRM contacts", with the people in brackets when they differ (spec C20). */
export const countsText = (p: { total: number; people: number }): string =>
  p.people === p.total ? `${n(p.total)} CRM contacts` : `${n(p.total)} CRM contacts (${n(p.people)} people)`;

/** The icon of a channel account's kind; unknown kinds get a plain chat icon. */
export const ChannelKindIcon: React.FunctionComponent<{ kind: ChannelKind | null }> = ({ kind }) => {
  switch (kind) {
    case 'WHATSAPP_WEB':
    case 'WHATSAPP_CLOUD':
      return <WhatsappIcon aria-label="WhatsApp" />;
    case 'INSTAGRAM':
      return <InstagramIcon aria-label="Instagram" />;
    case 'FACEBOOK':
      return <FacebookIcon aria-label="Facebook" />;
    default:
      return <CommentIcon aria-label="Channel" />;
  }
};

/**
 * Who matches the rules, for the signed-in user (spec C6, C19): asked 600 ms after the last change once every rule
 * is complete; an answer for an older tree is dropped; server refusals show inline and leave the builder usable.
 */
export const SegmentPreview: React.FunctionComponent<{ rules: SegmentRuleGroup; catalog: SegmentFieldCatalog }> = ({
  rules,
  catalog,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const complete = isComplete(rules, catalog);
  const body = React.useMemo(() => cleanRules(rules), [rules]);
  const key = JSON.stringify(body);
  const [answer, setAnswer] = React.useState<{ key: string; preview: Preview } | null>(null);
  const [error, setError] = React.useState<{ key: string; message: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshes, setRefreshes] = React.useState(0);
  // The tree in view now, for dropping an answer that was asked for an older tree.
  const keyRef = React.useRef(key);
  keyRef.current = key;

  React.useEffect(() => {
    if (!complete || !token) return undefined;
    const sent = key;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const p = await previewSegment(token, ws, body);
        if (keyRef.current !== sent) return;
        setAnswer({ key: sent, preview: p });
        setError(null);
      } catch (e) {
        if (keyRef.current !== sent) return;
        const message =
          e instanceof ApiError &&
          (e.code === 'SEGMENT_TOO_BROAD' || e.code === 'SEGMENT_TIMEOUT' || e.code === 'INVALID_SEGMENT')
            ? (e.serverMessage ?? e.message)
            : crmMessage(e);
        setError({ key: sent, message });
      } finally {
        if (keyRef.current === sent) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // the cleaned tree is what is sent; `refreshes` re-asks for the same tree
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, complete, token, ws, refreshes]);

  const current = answer?.key === key ? answer.preview : null;
  const currentError = error?.key === key ? error.message : null;

  return (
    <Card isCompact component="section" aria-label="Who matches">
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>Who matches</FlexItem>
          <FlexItem>
            <Button
              variant="plain"
              aria-label="Refresh"
              icon={<SyncAltIcon />}
              isDisabled={!complete || loading}
              onClick={() => setRefreshes((r) => r + 1)}
            />
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {!complete && (
          <HelperText>
            <HelperTextItem>{INCOMPLETE_TEXT}</HelperTextItem>
          </HelperText>
        )}
        {complete && loading && !current && <Spinner size="md" aria-label="Counting" />}
        {complete && currentError && <Alert variant="danger" isInline isPlain title={currentError} />}
        {complete && current && (
          <>
            <div className="pf-v6-u-font-size-lg">{countsText(current)}</div>
            {current.truncated && (
              <HelperText>
                <HelperTextItem variant="warning">{TRUNCATED_TEXT}</HelperTextItem>
              </HelperText>
            )}
            <DataList aria-label="Channel accounts" isCompact>
              {current.channelAccounts.map((row) => (
                <DataListItem key={row.channelAccountId ?? 'none'}>
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="kind" isIcon>
                          <ChannelKindIcon kind={row.kind} />
                        </DataListCell>,
                        <DataListCell key="label">{row.label}</DataListCell>,
                        <DataListCell key="count" alignRight>
                          {n(row.count)}
                        </DataListCell>,
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
              ))}
            </DataList>
          </>
        )}
      </CardBody>
    </Card>
  );
};
