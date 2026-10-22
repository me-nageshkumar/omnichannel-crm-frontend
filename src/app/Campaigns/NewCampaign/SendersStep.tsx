import * as React from 'react';
import { Alert, Checkbox, Content, HelperText, HelperTextItem, Spinner, Stack } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { SenderView } from '@app/api/campaigns';
import { shown } from '@app/api/phoneNumbers';
import type { StepProps } from '@app/Campaigns/NewCampaign/draft';
import { SenderStateLabel } from '@app/Campaigns/senderDisplay';
import { PhoneStatusLabel } from '@app/PhoneNumbers/PhoneNumberStatusLabel';

/** Only warming and active senders can be given to a campaign; resting ones are listed but not offered. */
const selectable = (s: SenderView) => s.state === 'WARMING' || s.state === 'ACTIVE';

/** The senders' combined daily cap. */
export const capPerDay = (senders: SenderView[]) => senders.reduce((sum, s) => sum + s.capToday, 0);

/** Choose the numbers the campaign sends from; nothing is preselected. */
export const SendersStep: React.FunctionComponent<
  StepProps & { senders: SenderView[] | undefined; error: string | null }
> = ({ draft, update, senders, error }) => {
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
