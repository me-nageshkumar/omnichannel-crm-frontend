import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Spinner,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { CampaignSettings, DayOfWeek, getCampaignSettings, updateCampaignSettings } from '@app/api/campaigns';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { NotFound } from '@app/NotFound/NotFound';
import { looserFields, timezoneOptions } from '@app/Campaigns/settingsModel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

const DAYS: [DayOfWeek, string][] = [
  ['MONDAY', 'Mon'],
  ['TUESDAY', 'Tue'],
  ['WEDNESDAY', 'Wed'],
  ['THURSDAY', 'Thu'],
  ['FRIDAY', 'Fri'],
  ['SATURDAY', 'Sat'],
  ['SUNDAY', 'Sun'],
];

type NumberKey =
  | 'gapMinSeconds'
  | 'gapMaxSeconds'
  | 'skipGapMinSeconds'
  | 'skipGapMaxSeconds'
  | 'hourlyCap'
  | 'matureCap'
  | 'healthyCap'
  | 'restDays'
  | 'recontactDays';

const NUMBER_FIELDS: [NumberKey, string][] = [
  ['gapMinSeconds', 'Minimum gap (seconds)'],
  ['gapMaxSeconds', 'Maximum gap (seconds)'],
  ['skipGapMinSeconds', 'Minimum gap after a skip (seconds)'],
  ['skipGapMaxSeconds', 'Maximum gap after a skip (seconds)'],
  ['hourlyCap', 'Hourly cap'],
  ['matureCap', 'Mature cap'],
  ['healthyCap', 'Healthy cap'],
  ['restDays', 'Rest days'],
  ['recontactDays', 'Recontact days'],
];

const FIELD_NAMES = [
  'timezone',
  'defaultCountryCode',
  'workingDays',
  'startTime',
  'endTime',
  ...NUMBER_FIELDS.map(([k]) => k),
  'warmupCaps',
  'stopWords',
  'version',
];

/** The form's text state: numbers stay strings while typed. */
interface Draft {
  timezone: string;
  defaultCountryCode: string;
  workingDays: DayOfWeek[];
  startTime: string;
  endTime: string;
  numbers: Record<NumberKey, string>;
  warmup: { fromDay: string; cap: string }[];
  stopWords: string;
  version: number;
}

function toDraft(s: CampaignSettings): Draft {
  const numbers = Object.fromEntries(NUMBER_FIELDS.map(([k]) => [k, String(s[k])])) as Record<NumberKey, string>;
  return {
    timezone: s.timezone,
    defaultCountryCode: s.defaultCountryCode,
    workingDays: s.workingDays,
    startTime: s.startTime,
    endTime: s.endTime,
    numbers,
    warmup: s.warmupCaps.map((r) => ({ fromDay: String(r.fromDay), cap: String(r.cap) })),
    stopWords: s.stopWords.join('\n'),
    version: s.version,
  };
}

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

function toSettings(d: Draft): CampaignSettings {
  const n = (k: NumberKey) => num(d.numbers[k]);
  return {
    timezone: d.timezone,
    defaultCountryCode: d.defaultCountryCode.trim(),
    workingDays: DAYS.map(([day]) => day).filter((day) => d.workingDays.includes(day)),
    startTime: d.startTime,
    endTime: d.endTime,
    gapMinSeconds: n('gapMinSeconds'),
    gapMaxSeconds: n('gapMaxSeconds'),
    skipGapMinSeconds: n('skipGapMinSeconds'),
    skipGapMaxSeconds: n('skipGapMaxSeconds'),
    hourlyCap: n('hourlyCap'),
    warmupCaps: d.warmup.map((r) => ({ fromDay: num(r.fromDay), cap: num(r.cap) })),
    matureCap: n('matureCap'),
    healthyCap: n('healthyCap'),
    restDays: n('restDays'),
    recontactDays: n('recontactDays'),
    stopWords: d.stopWords
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w !== ''),
    version: d.version,
  };
}

const whole = (v: number) => Number.isInteger(v) && v >= 1;

/** Client-side checks; keyed like the server's field errors. */
function check(s: CampaignSettings): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^[1-9][0-9]{0,3}$/.test(s.defaultCountryCode))
    e.defaultCountryCode = 'Enter 1 to 4 digits, not starting with 0';
  if (s.workingDays.length === 0) e.workingDays = 'Choose at least one working day';
  if (!s.startTime) e.startTime = 'Enter a start time';
  if (!s.endTime) e.endTime = 'Enter an end time';
  if (s.startTime && s.endTime && s.startTime >= s.endTime) e.endTime = 'Must be after the start time';
  for (const [k] of NUMBER_FIELDS) if (!whole(s[k])) e[k] = 'Enter a whole number, 1 or more';
  if (!e.gapMinSeconds && !e.gapMaxSeconds && s.gapMinSeconds > s.gapMaxSeconds) {
    e.gapMinSeconds = 'Must not exceed the maximum gap';
  }
  if (!e.skipGapMinSeconds && !e.skipGapMaxSeconds && s.skipGapMinSeconds > s.skipGapMaxSeconds) {
    e.skipGapMinSeconds = 'Must not exceed the maximum gap after a skip';
  }
  s.warmupCaps.forEach((r, i) => {
    if (!whole(r.fromDay) || !whole(r.cap)) e[`warmupCaps.${i}`] = 'Enter whole numbers, 1 or more';
  });
  return e;
}

const Help: React.FunctionComponent<{ error?: string; warn?: boolean }> = ({ error, warn }) =>
  error || warn ? (
    <FormHelperText>
      <HelperText>
        {error && <HelperTextItem variant="error">{error}</HelperTextItem>}
        {warn && <HelperTextItem variant="warning">Looser than the recommended value</HelperTextItem>}
      </HelperText>
    </FormHelperText>
  ) : null;

const SettingsForm: React.FunctionComponent<{
  loaded: CampaignSettings;
}> = ({ loaded }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const action = useAction(FIELD_NAMES);
  const [draft, setDraft] = React.useState(() => toDraft(loaded));
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState(false);

  const current = toSettings(draft);
  const looser = looserFields(current);
  const errors = { ...action.fieldErrors, ...clientErrors };
  const zones = React.useMemo(() => timezoneOptions(loaded.timezone), [loaded.timezone]);

  const change = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  const save = async () => {
    const found = check(current);
    setClientErrors(found);
    setSaved(false);
    if (Object.keys(found).length > 0) return;
    const reply = await action.run(() => updateCampaignSettings(token as string, ws, current));
    if (reply) {
      setDraft(toDraft(reply));
      setSaved(true);
    }
  };

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {action.error && <Alert variant="danger" isInline title={action.error} />}
      {saved && <Alert variant="success" isInline title="Settings saved." />}
      <FormGroup label="Timezone" fieldId="timezone">
        <FormSelect id="timezone" value={draft.timezone} onChange={(_e, v) => change({ timezone: v })}>
          {zones.map((z) => (
            <FormSelectOption key={z} value={z} label={z} />
          ))}
        </FormSelect>
        <Help error={errors.timezone} />
      </FormGroup>
      <FormGroup label="Default country code" fieldId="defaultCountryCode">
        <TextInput
          id="defaultCountryCode"
          value={draft.defaultCountryCode}
          onChange={(_e, v) => change({ defaultCountryCode: v })}
        />
        <Help error={errors.defaultCountryCode} />
      </FormGroup>
      <FormGroup label="Working days" role="group" fieldId="workingDays">
        {DAYS.map(([day, label]) => (
          <Checkbox
            key={day}
            id={`day-${day}`}
            label={label}
            isChecked={draft.workingDays.includes(day)}
            onChange={(_e, on) =>
              change({ workingDays: on ? [...draft.workingDays, day] : draft.workingDays.filter((x) => x !== day) })
            }
          />
        ))}
        <Help error={errors.workingDays} />
      </FormGroup>
      <FormGroup label="Start time" fieldId="startTime">
        <TextInput id="startTime" type="time" value={draft.startTime} onChange={(_e, v) => change({ startTime: v })} />
        <Help error={errors.startTime} />
      </FormGroup>
      <FormGroup label="End time" fieldId="endTime">
        <TextInput id="endTime" type="time" value={draft.endTime} onChange={(_e, v) => change({ endTime: v })} />
        <Help error={errors.endTime} />
      </FormGroup>
      {NUMBER_FIELDS.slice(0, 5).map(([k, label]) => (
        <FormGroup key={k} label={label} fieldId={k}>
          <TextInput
            id={k}
            type="number"
            value={draft.numbers[k]}
            onChange={(_e, v) => change({ numbers: { ...draft.numbers, [k]: v } })}
          />
          <Help error={errors[k]} warn={looser.has(k)} />
        </FormGroup>
      ))}
      <FormGroup label="Warm-up caps" role="group" fieldId="warmupCaps">
        <Table aria-label="Warm-up caps" variant="compact">
          <Thead>
            <Tr>
              <Th>From day</Th>
              <Th>Cap</Th>
            </Tr>
          </Thead>
          <Tbody>
            {draft.warmup.map((row, i) => {
              const set = (patch: Partial<typeof row>) =>
                change({ warmup: draft.warmup.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
              return (
                <Tr key={i}>
                  <Td dataLabel="From day">
                    <TextInput
                      aria-label={`Warm-up row ${i + 1} from day`}
                      type="number"
                      value={row.fromDay}
                      onChange={(_e, v) => set({ fromDay: v })}
                    />
                  </Td>
                  <Td dataLabel="Cap">
                    <TextInput
                      aria-label={`Warm-up row ${i + 1} cap`}
                      type="number"
                      value={row.cap}
                      onChange={(_e, v) => set({ cap: v })}
                    />
                    <Help error={errors[`warmupCaps.${i}`]} warn={looser.has(`warmupCaps.${i}`)} />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Help error={errors.warmupCaps} />
      </FormGroup>
      {NUMBER_FIELDS.slice(5).map(([k, label]) => (
        <FormGroup key={k} label={label} fieldId={k}>
          <TextInput
            id={k}
            type="number"
            value={draft.numbers[k]}
            onChange={(_e, v) => change({ numbers: { ...draft.numbers, [k]: v } })}
          />
          <Help error={errors[k]} warn={looser.has(k)} />
        </FormGroup>
      ))}
      <FormGroup label="Stop words" fieldId="stopWords">
        <TextArea id="stopWords" value={draft.stopWords} onChange={(_e, v) => change({ stopWords: v })} />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>One per line.</HelperTextItem>
          </HelperText>
        </FormHelperText>
        <Help error={errors.stopWords} warn={looser.has('stopWords')} />
      </FormGroup>
      <div>
        <Button type="submit" variant="primary" isLoading={action.busy} isDisabled={action.busy}>
          Save
        </Button>
      </div>
    </Form>
  );
};

const Loader: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const settings = useLoad((tk) => getCampaignSettings(tk, ws), [ws]);
  if (settings.error) return <Alert variant="danger" isInline title={settings.error} />;
  if (!settings.data) return <Spinner aria-label="Loading settings" />;
  return <SettingsForm loaded={settings.data} />;
};

/** The brand's campaign pacing and working window. */
export const CampaignSettingsPage: React.FunctionComponent = () => {
  const allowed = useAccess().hasInWorkspace('campaign:settings');
  // A route filtered out would fall through to /campaigns/:id, so the page itself says not found.
  if (!allowed) return <NotFound />;
  return (
    <PageShell
      title="Campaign settings"
      actions={
        <Button component={(p) => <Link {...p} to="/campaigns" />} variant="link">
          Back to campaigns
        </Button>
      }
    >
      <Loader />
    </PageShell>
  );
};
