import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  ExpandableSection,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Label,
  Switch,
  TextInput,
} from '@patternfly/react-core';
import type { RoutingSetting } from '@app/api/inbox';
import type { TeamMember } from '@app/api/teams';
import { useAction } from '@app/admin/useAction';

const MAX_STICKY_DAYS = 365;

/**
 * One routing setting as the two switches of design §3.4 (assign to team, round robin), the sticky window and the
 * reply/close behaviours; team cards add the advanced "one member" option and can fall back to the brand default.
 */
export const RoutingSettingsCard: React.FunctionComponent<{
  title: string;
  setting: RoutingSetting;
  /** Members of the team, for the one-member option; absent on the brand default. */
  members?: TeamMember[];
  onSave(setting: RoutingSetting): Promise<RoutingSetting>;
  onUseDefault?(): Promise<void>;
}> = ({ title, setting, members, onSave, onUseDefault }) => {
  const id = (field: string) => `routing-${setting.teamId ?? 'default'}-${field}`;
  const [draft, setDraft] = React.useState<RoutingSetting>(setting);
  const [days, setDays] = React.useState(String(setting.stickyDays));
  const [editing, setEditing] = React.useState(!setting.inherited);
  const [advanced, setAdvanced] = React.useState(Boolean(setting.userId));
  const [saved, setSaved] = React.useState(false);
  // Only the fields this card renders an error under; any other field the server names goes to the banner.
  const action = useAction(members ? ['stickyDays', 'userId'] : ['stickyDays']);
  React.useEffect(() => {
    setDraft(setting);
    setDays(String(setting.stickyDays));
    setEditing(!setting.inherited);
    setAdvanced(Boolean(setting.userId));
  }, [setting]);

  const change = (patch: Partial<RoutingSetting>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const disabled = !editing || action.busy;
  const stickyDays = Number(days);
  const daysOk = days.trim() !== '' && Number.isInteger(stickyDays) && stickyDays >= 0 && stickyDays <= MAX_STICKY_DAYS;

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!daysOk) return;
    const result = await action.run(() => onSave({ ...draft, stickyDays }));
    if (result) setSaved(true);
  };
  const revertToDefault = async () => {
    if (!onUseDefault) return;
    setSaved(false);
    await action.run(async () => {
      await onUseDefault();
      return true;
    });
  };

  return (
    <Card component="section" aria-label={title} isCompact>
      <CardTitle>
        {title}
        {setting.inherited && (
          <Label isCompact color="grey" style={{ marginInlineStart: 'var(--pf-t--global--spacer--sm)' }}>
            Using brand default
          </Label>
        )}
      </CardTitle>
      <CardBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id={id('form')} onSubmit={submit} isHorizontal>
          <Switch
            id={id('assign')}
            label="Assign incoming chats to the team"
            isChecked={draft.assignToTeam}
            isDisabled={disabled}
            onChange={(_e, on) => change(on ? { assignToTeam: true } : { assignToTeam: false, roundRobin: false, userId: null })}
          />
          <Switch
            id={id('rr')}
            label="Round robin among available members"
            isChecked={draft.roundRobin}
            isDisabled={disabled || !draft.assignToTeam || draft.userId !== null}
            onChange={(_e, on) => change({ roundRobin: on })}
          />
          {members && (
            <ExpandableSection
              toggleText="Advanced"
              isExpanded={advanced}
              onToggle={(_e, open) => setAdvanced(open)}
              isIndented
            >
              <FormGroup label="Always assign to one member" fieldId={id('member')}>
                <FormSelect
                  id={id('member')}
                  value={draft.userId ?? ''}
                  isDisabled={disabled || !draft.assignToTeam}
                  onChange={(_e, v) => change(v ? { userId: v, roundRobin: false } : { userId: null })}
                >
                  <FormSelectOption value="" label="Nobody in particular" />
                  {members.map((m) => (
                    <FormSelectOption key={m.id} value={m.id} label={m.name} />
                  ))}
                </FormSelect>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant={action.fieldErrors.userId ? 'error' : 'default'}>
                      {action.fieldErrors.userId ?? 'When that member is away, chats wait in the team queue.'}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            </ExpandableSection>
          )}
          <FormGroup label="Sticky window (days)" fieldId={id('sticky')}>
            <TextInput
              id={id('sticky')}
              type="number"
              min={0}
              max={MAX_STICKY_DAYS}
              value={days}
              isDisabled={disabled}
              validated={daysOk ? 'default' : 'error'}
              onChange={(_e, v) => {
                setSaved(false);
                setDays(v);
              }}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={daysOk ? 'default' : 'error'}>
                  {action.fieldErrors.stickyDays ??
                    `A returning customer goes back to the agent who last handled them within this many days; 0 turns it off.`}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <Switch
            id={id('claim')}
            label="Claim on reply"
            isChecked={draft.claimOnReply}
            isDisabled={disabled}
            onChange={(_e, on) => change({ claimOnReply: on })}
          />
          <Switch
            id={id('keep')}
            label="Keep assignment on close"
            isChecked={draft.keepAssignmentOnClose}
            isDisabled={disabled}
            onChange={(_e, on) => change({ keepAssignmentOnClose: on })}
          />
          <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', alignItems: 'center' }}>
            {editing ? (
              <Button type="submit" variant="primary" isDisabled={action.busy || !daysOk} isLoading={action.busy}>
                Save
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Override
              </Button>
            )}
            {onUseDefault && !setting.inherited && (
              <Button variant="link" onClick={() => void revertToDefault()} isDisabled={action.busy}>
                Use brand default
              </Button>
            )}
            {saved && <span>Saved</span>}
          </div>
        </Form>
      </CardBody>
    </Card>
  );
};
