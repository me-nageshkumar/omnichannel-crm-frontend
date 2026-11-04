import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AlertActionLink,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  Spinner,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import { getRule } from '@app/api/automations';
import type {
  AutomationOptions,
  AutomationTest,
  ConditionLeaf,
  EventData,
  Preflight,
  Rule,
} from '@app/api/automations';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { adLink } from '@app/Inbox/chatDisplay';
import { useSession } from '@app/session/SessionContext';
import { MESSAGE_KINDS, conditionText } from '@app/Automations/automationModel';
import { actualLabel, endedText, waitingText } from '@app/Automations/automationDisplay';
import { useAutomationOptions } from '@app/Automations/useAutomationOptions';
import { useAutomationTest } from '@app/Automations/useAutomationTest';
import { TestContactPicker } from '@app/Automations/TestContactPicker';
import { TestSteps } from '@app/Automations/TestSteps';

export const ONLY_DRAFTS_TEXT = 'Only drafts can be tested.';
export const WAITING_NOTE =
  "Only this contact's messages are taken; everyone else is ignored. Published rules keep running for this contact.";
export const REPLAY_HELP = 'Runs the same event again from its first condition. The actions really happen again.';
export const NO_MATCH_TEXT = 'The rule does not match: live, its actions would not run on this event.';
export const NO_CONDITIONS_TEXT = 'No conditions: the rule matches every event.';

const Section: React.FunctionComponent<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <StackItem>
    <Title headingLevel="h2" size="md" style={{ marginBottom: 'var(--pf-t--global--spacer--sm)' }}>
      {title}
    </Title>
    {children}
  </StackItem>
);

/** Blockers stop the start; warnings say what the test will really do to the contact. */
const PreflightPanel: React.FunctionComponent<{
  preflight: Preflight | undefined;
  error: string | null;
  onCheckAgain(): void;
}> = ({ preflight, error, onCheckAgain }) => {
  const checks = preflight?.checks ?? [];
  const blockers = checks.filter((c) => c.level === 'BLOCKER');
  const warnings = checks.filter((c) => c.level === 'WARNING');
  const list = (checks: Preflight['checks']) => (
    <ul>
      {checks.map((c, i) => (
        <li key={i}>{c.message}</li>
      ))}
    </ul>
  );
  return (
    <Stack hasGutter>
      {error && <Alert variant="danger" isInline title={error} />}
      {blockers.length > 0 && (
        <Alert variant="danger" isInline title="Fix these before testing">
          {list(blockers)}
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert variant="info" isInline title="This will really happen to the test contact">
          {list(warnings)}
        </Alert>
      )}
      <div>
        <Button variant="link" isInline onClick={onCheckAgain}>
          Check again
        </Button>
      </div>
    </Stack>
  );
};

const money = (amount: number, currency: string | null) => (currency ? `${amount} ${currency}` : String(amount));

/** The captured event's data as label / value pairs. */
function eventRows(t: AutomationTest, data: EventData): [string, React.ReactNode][] {
  const rows: [string, React.ReactNode][] = [];
  if (t.event === 'MESSAGE_RECEIVED') {
    if (data.chat) {
      const chat = data.chat.isNew ? 'New' : 'Existing';
      rows.push(['Chat', t.captured?.treatedAsNew ? `${chat} (treated as new)` : chat]);
    }
    if (data.message) {
      rows.push(['Message', data.message.text ?? '—']);
      rows.push(['Type', MESSAGE_KINDS.find((k) => k.kind === data.message?.type)?.label ?? data.message.type]);
      const ad = data.message.ad;
      if (ad) {
        const href = adLink(ad.sourceUrl);
        const headline = ad.headline || 'an ad';
        rows.push([
          'From ad',
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {headline}
            </a>
          ) : (
            headline
          ),
        ]);
      }
    }
    if (data.number) rows.push(['Number', data.number.label ?? `+${data.number.number}`]);
  } else {
    rows.push(['Deal', data.deal?.title]);
    rows.push(['Pipeline', data.pipeline?.name]);
    rows.push(['From', data.fromLane?.name]);
    rows.push(['To', data.toLane?.name]);
    if (data.deal?.amount !== null && data.deal?.amount !== undefined) {
      rows.push(['Amount', money(data.deal.amount, data.deal.currency)]);
    }
    rows.push(['Owner', data.deal?.owner?.name]);
  }
  if (data.contact) {
    const c = data.contact;
    rows.push(['Contact', [c.name, c.phone ? `+${c.phone}` : 'Number hidden'].filter(Boolean).join(' · ')]);
    if (t.event === 'MESSAGE_RECEIVED') rows.push(['In the CRM', c.inCrm ? 'Yes' : 'No']);
  }
  return rows.filter((r) => r[1] !== undefined && r[1] !== null && r[1] !== '');
}

const EventSection: React.FunctionComponent<{ test: AutomationTest }> = ({ test }) => {
  if (!test.captured) return null;
  return (
    <Section title="The event">
      <DescriptionList isHorizontal isCompact>
        {eventRows(test, test.captured.data).map(([term, value]) => (
          <DescriptionListGroup key={term}>
            <DescriptionListTerm>{term}</DescriptionListTerm>
            <DescriptionListDescription>{value}</DescriptionListDescription>
          </DescriptionListGroup>
        ))}
      </DescriptionList>
    </Section>
  );
};

const ConditionsSection: React.FunctionComponent<{
  test: AutomationTest;
  options: AutomationOptions;
  busy: boolean;
  onCheck(): void;
}> = ({ test, options, busy, onCheck }) => (
  <Section title="Conditions">
    {test.conditionCount === 0 ? (
      <p>{NO_CONDITIONS_TEXT}</p>
    ) : (
      <Stack hasGutter>
        {test.conditions.length > 0 && (
          <ul aria-label="Checked conditions" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {test.conditions.map((c) => {
              const leaf = { field: c.field, operator: c.operator, value: c.value } as ConditionLeaf;
              return (
                <li
                  key={c.path}
                >{`${c.passed ? '✔' : '✖'} ${conditionText(leaf, options)} · saw ${actualLabel(c.field, c.actual, options, test.captured?.data ?? null)}`}</li>
              );
            })}
          </ul>
        )}
        {test.conditions.length < test.conditionCount && (
          <div>
            <Button variant="secondary" isDisabled={busy} onClick={onCheck}>
              Check next condition
            </Button>
          </div>
        )}
        {test.matched === true && <Alert variant="success" isInline isPlain title="The rule matches." />}
        {test.matched === false && <Alert variant="warning" isInline isPlain title={NO_MATCH_TEXT} />}
      </Stack>
    )}
  </Section>
);

/** The test of one draft rule, from choosing the contact to running its actions one by one. */
const TestRunner: React.FunctionComponent<{ rule: Rule; options: AutomationOptions; title: string }> = ({
  rule,
  options,
  title,
}) => {
  const navigate = useNavigate();
  const h = useAutomationTest(rule.id);
  const test = h.test;

  if (h.published) return <OnlyDrafts title={title} ruleId={rule.id} />;
  if (h.loading) {
    return (
      <PageShell title={title}>
        <Spinner aria-label="Loading the test" />
      </PageShell>
    );
  }

  const done = async () => {
    if (await h.end()) navigate(`/automations/${rule.id}`);
  };

  return (
    <PageShell title={title}>
      <Stack hasGutter style={{ maxWidth: '64rem' }}>
        {h.error && (
          <StackItem>
            <Alert variant="danger" isInline title={h.error} />
          </StackItem>
        )}
        {h.otherTest && (
          <StackItem>
            <Alert
              variant="warning"
              isInline
              title={`${h.otherTest.startedByName} is testing this rule.`}
              actionLinks={
                <AlertActionLink onClick={() => void h.endOtherTest()} isDisabled={h.busy}>
                  End that test
                </AlertActionLink>
              }
            />
          </StackItem>
        )}

        {!test && (
          <Section title="Choose the test contact">
            <TestContactPicker
              event={rule.event}
              canStart={h.preflight?.canRun ?? false}
              busy={h.busy}
              onStart={(body) => void h.start(body)}
              preflight={
                <PreflightPanel
                  preflight={h.preflight}
                  error={h.preflightError}
                  onCheckAgain={() => void h.reloadPreflight()}
                />
              }
            />
          </Section>
        )}

        {test?.status === 'WAITING' && (
          <Section title="Waiting for the event">
            <Stack hasGutter>
              <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                <FlexItem>
                  <Spinner size="md" aria-label="Waiting for the event" />
                </FlexItem>
                <FlexItem>{waitingText(test, options)}</FlexItem>
              </Flex>
              <HelperText>
                <HelperTextItem>{WAITING_NOTE}</HelperTextItem>
              </HelperText>
              <div>
                <Button variant="secondary" isDisabled={h.busy} onClick={() => void h.end()}>
                  Stop test
                </Button>
              </div>
            </Stack>
          </Section>
        )}

        {test?.status === 'CAPTURED' && (
          <>
            <EventSection test={test} />
            <ConditionsSection test={test} options={options} busy={h.busy} onCheck={() => void h.check()} />
            <Section title="Actions">
              <TestSteps
                steps={test.actions}
                nextAction={test.nextAction}
                busy={h.busy}
                onRun={(i) => void h.run(i)}
                onSkip={(i) => void h.skip(i)}
              />
            </Section>
            <StackItem>
              <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsFlexStart' }}>
                <FlexItem>
                  <Button variant="secondary" isDisabled={h.busy} onClick={() => void h.again()}>
                    Test again
                  </Button>
                </FlexItem>
                <FlexItem>
                  <Button variant="secondary" isDisabled={h.busy} onClick={() => void h.replay()}>
                    Replay this event
                  </Button>
                  <HelperText>
                    <HelperTextItem>{REPLAY_HELP}</HelperTextItem>
                  </HelperText>
                </FlexItem>
                <FlexItem>
                  <Button variant="primary" isDisabled={h.busy} onClick={() => void done()}>
                    Done
                  </Button>
                </FlexItem>
              </Flex>
            </StackItem>
          </>
        )}

        {test?.status === 'ENDED' && (
          <StackItem>
            <Alert
              variant="info"
              isInline
              title={endedText(test.endReason)}
              actionLinks={<AlertActionLink onClick={h.clear}>Start a new test</AlertActionLink>}
            />
          </StackItem>
        )}
      </Stack>
    </PageShell>
  );
};

const OnlyDrafts: React.FunctionComponent<{ title: string; ruleId: string }> = ({ title, ruleId }) => (
  <PageShell title={title}>
    <Alert variant="info" isInline title={ONLY_DRAFTS_TEXT}>
      <Link to={`/automations/${ruleId}`}>Back to the rule</Link>
    </Alert>
  </PageShell>
);

/** /automations/:id/test: a draft rule tried step by step on one chosen contact. */
export const AutomationTestPage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const options = useAutomationOptions();
  const rule = useLoad((tk) => getRule(tk, ws, id), [ws, id]);

  const error = options.error ?? rule.error;
  if (error || !options.data || !rule.data) {
    return (
      <PageShell title="Test rule">
        {error ? <Alert variant="danger" isInline title={error} /> : <Spinner aria-label="Loading rule" />}
      </PageShell>
    );
  }
  const title = `Test “${rule.data.name}”`;
  if (rule.data.status === 'PUBLISHED') return <OnlyDrafts title={title} ruleId={rule.data.id} />;
  return <TestRunner key={rule.data.id} rule={rule.data} options={options.data} title={title} />;
};
