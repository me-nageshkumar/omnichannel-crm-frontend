import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Flex, FlexItem, Spinner, TextInput } from '@patternfly/react-core';
import { PencilAltIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { IAction } from '@patternfly/react-table';
import { SenderAction, SenderView, listSenders, updateSender } from '@app/api/campaigns';
import { isSenderState, senderActionMessage } from '@app/api/messages';
import { shown } from '@app/api/phoneNumbers';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { SenderStateLabel, pauseText } from '@app/Campaigns/senderDisplay';
import { PhoneStatusLabel } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

const TITLES: Record<SenderAction, string> = {
  REST: 'Rest',
  RETIRE: 'Retire',
  REACTIVATE: 'Reactivate',
  RESUME: 'Resume pause',
};

/** The actions a sender's state allows; none of them ever makes it ACTIVE directly. */
function actionsFor(s: SenderView, now = Date.now()): SenderAction[] {
  const acts: SenderAction[] = [];
  if (s.state === 'WARMING' || s.state === 'ACTIVE') acts.push('REST');
  if (s.state !== 'RETIRED') acts.push('RETIRE');
  if (s.state === 'RETIRED' || s.state === 'RESTING' || s.state === 'SUSPENDED') acts.push('REACTIVATE');
  if (s.pausedUntil && new Date(s.pausedUntil).getTime() > now) acts.push('RESUME');
  return acts;
}

/** The runs-on text with, for those who may, an inline editor. */
const RunsOn: React.FunctionComponent<{
  sender: SenderView;
  canEdit: boolean;
  onSave(runsOn: string | null): Promise<boolean>;
}> = ({ sender, canEdit, onSave }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState('');

  const save = async () => {
    if (await onSave(value.trim() === '' ? null : value.trim())) setEditing(false);
  };

  if (!editing) {
    return (
      <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'nowrap' }}>
        <FlexItem>{sender.runsOn ?? '—'}</FlexItem>
        {canEdit && (
          <FlexItem>
            <Button
              variant="plain"
              aria-label="Edit runs on"
              icon={<PencilAltIcon />}
              onClick={() => {
                setValue(sender.runsOn ?? '');
                setEditing(true);
              }}
            />
          </FlexItem>
        )}
      </Flex>
    );
  }
  return (
    <>
      <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'nowrap' }}>
        <FlexItem>
          <TextInput
            aria-label="Runs on"
            value={value}
            onChange={(_e, v) => setValue(v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save();
              }
            }}
          />
        </FlexItem>
        <FlexItem>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            Save
          </Button>
        </FlexItem>
        <FlexItem>
          <Button variant="link" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </FlexItem>
      </Flex>
    </>
  );
};

/** The brand's campaign senders with their state, capacity and the actions on them. */
export const SendersPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canSettings = useAccess().hasInWorkspace('campaign:settings');
  const senders = useLoad((tk) => listSenders(tk, ws), [ws]);
  const action = useAction();
  const [retiring, setRetiring] = React.useState<SenderView | null>(null);
  const items = senders.data ?? [];

  const replace = (updated: SenderView) =>
    senders.setData((cur) => cur?.map((s) => (s.phoneNumberId === updated.phoneNumberId ? updated : s)));

  const update = async (s: SenderView, body: { runsOn?: string | null; action?: SenderAction }) => {
    const act = body.action;
    const updated = await action.run(
      () =>
        updateSender(token as string, ws, s.phoneNumberId, body).catch((e: unknown) => {
          // The sender changed under us (e.g. it was suspended); show where it is now.
          if (isSenderState(e)) senders.reload();
          throw e;
        }),
      act ? (e) => senderActionMessage(e, act) : undefined,
    );
    if (updated) replace(updated);
    return updated;
  };

  const choose = (a: SenderAction, s: SenderView) => {
    if (a === 'RETIRE') {
      action.reset();
      setRetiring(s);
    } else {
      void update(s, { action: a });
    }
  };

  const confirmRetire = async () => {
    if (retiring && (await update(retiring, { action: 'RETIRE' }))) setRetiring(null);
  };

  const menuFor = (s: SenderView): IAction[] =>
    actionsFor(s).map((a) => ({ title: TITLES[a], onClick: () => choose(a, s) }));

  return (
    <PageShell
      title="Senders"
      actions={
        <Button component={(p) => <Link {...p} to="/campaigns" />} variant="link">
          Back to campaigns
        </Button>
      }
    >
      {senders.error && <Alert variant="danger" isInline title={senders.error} />}
      {!retiring && action.error && <Alert variant="danger" isInline title={action.error} />}
      {senders.loading && !senders.data ? (
        <Spinner aria-label="Loading senders" />
      ) : (
        <Table aria-label="Senders" variant="compact">
          <Thead>
            <Tr>
              <Th>Number</Th>
              <Th>Label</Th>
              <Th>Phone status</Th>
              <Th>State</Th>
              <Th>Age</Th>
              <Th>Cap today</Th>
              <Th>Used today</Th>
              <Th>Pause</Th>
              <Th>Runs on</Th>
              {canSettings && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <Tr>
                <Td colSpan={canSettings ? 10 : 9}>No senders yet.</Td>
              </Tr>
            ) : (
              items.map((s) => (
                <Tr key={s.phoneNumberId}>
                  <Td dataLabel="Number">{shown(s.number)}</Td>
                  <Td dataLabel="Label">{s.label ?? '—'}</Td>
                  <Td dataLabel="Phone status">
                    <PhoneStatusLabel status={s.phoneStatus} />
                  </Td>
                  <Td dataLabel="State">
                    <SenderStateLabel sender={s} />
                  </Td>
                  <Td dataLabel="Age">{`Day ${s.ageDay}`}</Td>
                  <Td dataLabel="Cap today">{s.capToday}</Td>
                  <Td dataLabel="Used today">{s.usedToday}</Td>
                  <Td dataLabel="Pause">{pauseText(s) ?? '—'}</Td>
                  <Td dataLabel="Runs on">
                    <RunsOn
                      sender={s}
                      canEdit={canSettings}
                      onSave={async (runsOn) => {
                        const ok = await update(s, { runsOn });
                        return ok !== undefined;
                      }}
                    />
                  </Td>
                  {canSettings && (
                    <Td isActionCell>
                      <ActionsColumn items={menuFor(s)} />
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      )}
      {retiring && (
        <ConfirmModal
          title="Retire this number?"
          confirmLabel="Retire"
          variant="danger"
          busy={action.busy}
          error={action.error}
          onConfirm={() => void confirmRetire()}
          onCancel={() => {
            setRetiring(null);
            action.reset();
          }}
        >
          It will send no campaign messages until reactivated.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
