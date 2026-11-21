import * as React from 'react';
import {
  Alert,
  Checkbox,
  Content,
  HelperText,
  HelperTextItem,
  Spinner,
  Stack,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { CloudSenderView, SenderView } from '@app/api/campaigns';
import { shown } from '@app/api/phoneNumbers';
import { type StepProps, sendersReady, setChannel } from '@app/Campaigns/NewCampaign/draft';
import { SenderStateLabel } from '@app/Campaigns/senderDisplay';
import { PhoneStatusLabel } from '@app/PhoneNumbers/PhoneNumberStatusLabel';

/** Only warming and active senders can be given to a campaign; resting ones are listed but not offered. */
const selectable = (s: SenderView) => s.state === 'WARMING' || s.state === 'ACTIVE';

/** The senders' combined daily cap. */
export const capPerDay = (senders: SenderView[]) => senders.reduce((sum, s) => sum + s.capToday, 0);

/** Choose the kind of number, then the numbers the campaign sends from; nothing is preselected. */
export const SendersStep: React.FunctionComponent<
  StepProps & {
    senders: SenderView[] | undefined;
    error: string | null;
    cloud: CloudSenderView[] | undefined;
    cloudError: string | null;
  }
> = ({ draft, update, senders, error, cloud, cloudError }) => (
  <Stack hasGutter>
    <ToggleGroup aria-label="Kind of number">
      <ToggleGroupItem
        text="WhatsApp Web numbers"
        buttonId="kind-web"
        isSelected={draft.channel === 'WHATSAPP_WEB'}
        onChange={() => update((d) => setChannel(d, 'WHATSAPP_WEB'))}
      />
      <ToggleGroupItem
        text="Cloud API numbers"
        buttonId="kind-cloud"
        isSelected={draft.channel === 'WHATSAPP_CLOUD_API'}
        onChange={() => update((d) => setChannel(d, 'WHATSAPP_CLOUD_API'))}
      />
    </ToggleGroup>
    {draft.channel === 'WHATSAPP_CLOUD_API' ? (
      <CloudSenders draft={draft} update={update} cloud={cloud} error={cloudError} />
    ) : (
      <WebSenders draft={draft} update={update} senders={senders} error={error} />
    )}
  </Stack>
);

/** The time of day a hold ends, as the brand's clock shows it. */
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** What a Cloud number's daily limit allows, and what is left of it. */
export function limitNotes(s: CloudSenderView): string[] {
  const notes: string[] = [];
  if (s.heldUntil) notes.push(`Meta asked to wait until ${timeOf(s.heldUntil)}`);
  else if (s.dailyLimit !== null && s.usedLast24h >= s.dailyLimit) {
    notes.push('Limit reached — goes on as the 24 hours roll');
  }
  return notes;
}

/** Cloud numbers: no warm-up; Meta's daily limit, quality and readiness instead. */
const CloudSenders: React.FunctionComponent<
  StepProps & { cloud: CloudSenderView[] | undefined; error: string | null }
> = ({ draft, update, cloud, error }) => {
  const ids = draft.senderIds;
  const toggle = (id: string, on: boolean) =>
    update({ senderIds: on ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id) });
  const problem = ids.length > 0 ? sendersReady(draft, cloud ?? []) : null;
  return (
    <Stack hasGutter>
      {error && <Alert variant="danger" isInline title={error} />}
      {!cloud ? (
        !error && <Spinner aria-label="Loading Cloud numbers" />
      ) : (
        <Table aria-label="Cloud API numbers" variant="compact">
          <Thead>
            <Tr>
              <Th screenReaderText="Select" />
              <Th>Number</Th>
              <Th>Quality</Th>
              <Th>Daily limit</Th>
              <Th>Used</Th>
            </Tr>
          </Thead>
          <Tbody>
            {cloud.length === 0 ? (
              <Tr>
                <Td colSpan={5}>No Cloud API numbers yet.</Td>
              </Tr>
            ) : (
              cloud.map((s) => {
                const name = s.label ?? shown(s.number);
                return (
                  <Tr key={s.phoneNumberId}>
                    <Td dataLabel="Select">
                      <Checkbox
                        id={`cloud-sender-${s.phoneNumberId}`}
                        aria-label={`Select ${name}`}
                        isChecked={ids.includes(s.phoneNumberId)}
                        isDisabled={!s.canSend}
                        onChange={(_e, on) => toggle(s.phoneNumberId, on)}
                      />
                    </Td>
                    <Td dataLabel="Number">
                      {name}
                      {s.label && <Content component="small">{` ${shown(s.number)}`}</Content>}
                      <HelperText>
                        {!s.canSend && <HelperTextItem variant="warning">Not ready to send</HelperTextItem>}
                        {limitNotes(s).map((n) => (
                          <HelperTextItem key={n} variant="indeterminate">
                            {n}
                          </HelperTextItem>
                        ))}
                      </HelperText>
                    </Td>
                    <Td dataLabel="Quality">{s.qualityRating ?? '—'}</Td>
                    <Td dataLabel="Daily limit">{s.dailyLimit === null ? 'No limit' : `${s.dailyLimit} a day`}</Td>
                    <Td dataLabel="Used">{`${s.usedLast24h} used in the last 24 hours`}</Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      )}
      {problem && (
        <HelperText>
          <HelperTextItem variant="error">{problem}</HelperTextItem>
        </HelperText>
      )}
    </Stack>
  );
};

/** WhatsApp Web senders, as before Cloud campaigns. */
const WebSenders: React.FunctionComponent<StepProps & { senders: SenderView[] | undefined; error: string | null }> = ({
  draft,
  update,
  senders,
  error,
}) => {
  const ids = draft.senderIds;
  const toggle = (id: string, on: boolean) =>
    update({ senderIds: on ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id) });
  const chosen = (senders ?? []).filter((s) => ids.includes(s.phoneNumberId));

  return (
    <Stack hasGutter>
      {error && <Alert variant="danger" isInline title={error} />}
      {!senders ? (
        !error && <Spinner aria-label="Loading senders" />
      ) : (
        <Table aria-label="Senders" variant="compact">
          <Thead>
            <Tr>
              <Th screenReaderText="Select" />
              <Th>Number</Th>
              <Th>State</Th>
              <Th>Age</Th>
              <Th>Cap today</Th>
              <Th>Used today</Th>
              <Th>Phone status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {senders.length === 0 ? (
              <Tr>
                <Td colSpan={7}>No senders yet.</Td>
              </Tr>
            ) : (
              senders.map((s) => (
                <Tr key={s.phoneNumberId}>
                  <Td dataLabel="Select">
                    {selectable(s) && (
                      <Checkbox
                        id={`sender-${s.phoneNumberId}`}
                        aria-label={`Select ${shown(s.number)}`}
                        isChecked={ids.includes(s.phoneNumberId)}
                        onChange={(_e, on) => toggle(s.phoneNumberId, on)}
                      />
                    )}
                  </Td>
                  <Td dataLabel="Number">
                    {shown(s.number)}
                    {selectable(s) && s.phoneStatus !== 'CONNECTED' && (
                      <HelperText>
                        <HelperTextItem variant="warning">not connected</HelperTextItem>
                      </HelperText>
                    )}
                  </Td>
                  <Td dataLabel="State">
                    <SenderStateLabel sender={s} />
                  </Td>
                  <Td dataLabel="Age">{`Day ${s.ageDay}`}</Td>
                  <Td dataLabel="Cap today">{s.capToday}</Td>
                  <Td dataLabel="Used today">{s.usedToday}</Td>
                  <Td dataLabel="Phone status">
                    <PhoneStatusLabel status={s.phoneStatus} />
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      )}
      {chosen.length > 0 && (
        <Content component="p">{`Selected senders can send about ${capPerDay(chosen)} messages a day`}</Content>
      )}
    </Stack>
  );
};
