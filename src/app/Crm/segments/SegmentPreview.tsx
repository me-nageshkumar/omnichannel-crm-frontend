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
import { cleanRules, countsText, isComplete, splitErrors } from '@app/Crm/segments/segmentModel';

export const DEBOUNCE_MS = 600;
export const INCOMPLETE_TEXT = 'Finish the rules to see who matches';
export const TRUNCATED_TEXT = 'first 50,000 only — narrow the rules before sending';

const n = (v: number) => v.toLocaleString('en-US');

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
export const SegmentPreview: React.FunctionComponent<{
  rules: SegmentRuleGroup;
  catalog: SegmentFieldCatalog;
  /** Told the per-rule problems the server found, keyed by rule path, so they land on the rules themselves. */
  onRuleErrors?(byPath: Record<string, string>): void;
}> = ({ rules, catalog, onRuleErrors }) => {
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
  // The last request sent: the answer to that one ends the busy state, whatever tree is in view by then.
  const lastAsk = React.useRef(0);

  React.useEffect(() => {
    if (!complete || !token) return undefined;
    const sent = key;
    const timer = setTimeout(async () => {
      const ask = ++lastAsk.current;
      setLoading(true);
      try {
        const p = await previewSegment(token, ws, body);
        if (keyRef.current !== sent) return;
        setAnswer({ key: sent, preview: p });
        setError(null);
      } catch (e) {
        if (keyRef.current !== sent) return;
        // an older count for this tree must not stay under the refusal
        setAnswer(null);
        if (e instanceof ApiError && e.code === 'INVALID_SEGMENT') {
          const split = splitErrors(e.extra ?? {}, body);
          onRuleErrors?.(split.byPath);
          const other = split.other.filter((m) => !m.startsWith('name:'));
          // kept even when empty: the problems are on the rules, but this tree has had its answer
          setError({ key: sent, message: other.join('; ') });
          return;
        }
        const message =
          e instanceof ApiError && (e.code === 'SEGMENT_TOO_BROAD' || e.code === 'SEGMENT_TIMEOUT')
            ? (e.serverMessage ?? e.message)
            : crmMessage(e);
        setError({ key: sent, message });
      } finally {
        if (lastAsk.current === ask) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // the cleaned tree is what is sent; `refreshes` re-asks for the same tree
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, complete, token, ws, refreshes]);

  const current = answer?.key === key ? answer.preview : null;
  const currentError = error?.key === key ? error.message : null;
  // from the first change: an answer for this tree may still be up to 600 ms from being asked for
  const counting = complete && !current && (loading || error?.key !== key);

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
        {counting && <Spinner size="md" aria-label="Counting" />}
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
