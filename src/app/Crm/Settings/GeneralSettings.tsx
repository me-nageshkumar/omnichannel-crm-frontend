import * as React from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Spinner,
  Switch,
  TextInput,
} from '@patternfly/react-core';
import { getSettings, listPipelines, putSettings } from '@app/api/crm';
import type { CrmSettings } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { ConflictAlert, isCode } from '@app/Crm/Settings/ConflictAlert';

const CURRENCY = /^[A-Z]{3}$/;

/** Currency, default pipeline, deal rotting days and two switches. Saves the whole settings with their version. */
export const GeneralSettings: React.FunctionComponent<{ canManage: boolean }> = ({ canManage }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad(
    async (t) => {
      const [settings, pipelines] = await Promise.all([getSettings(t, ws), listPipelines(t, ws)]);
      return { settings, pipelines };
    },
    [ws],
  );
  const action = useAction();
  const [currency, setCurrency] = React.useState('');
  const [pipelineId, setPipelineId] = React.useState('');
  const [rotting, setRotting] = React.useState('');
  const [allowMove, setAllowMove] = React.useState(true);
  const [showMessages, setShowMessages] = React.useState(true);
  const [conflict, setConflict] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const settings = loaded.data?.settings;
  React.useEffect(() => {
    if (!settings) return;
    setCurrency(settings.defaultCurrency);
    setPipelineId(settings.defaultPipelineId ?? '');
    setRotting(settings.dealRottingDays == null ? '' : String(settings.dealRottingDays));
    setAllowMove(settings.allowChannelMove);
    setShowMessages(settings.timelineShowsWhatsappMessages);
    setConflict(false);
  }, [settings]);

  if (loaded.loading && !loaded.data) return <Spinner aria-label="Loading settings" />;
  if (!loaded.data || !settings) return <Alert variant="danger" isInline title={loaded.error ?? 'Could not load.'} />;

  const active = loaded.data.pipelines.filter((p) => p.active);
  const currencyOk = CURRENCY.test(currency);
  const rottingOk = rotting === '' || (/^\d+$/.test(rotting) && Number(rotting) >= 1 && Number(rotting) <= 365);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setSaved(false);
    const body: CrmSettings = {
      ...settings,
      defaultCurrency: currency,
      defaultPipelineId: pipelineId || null,
      dealRottingDays: rotting === '' ? null : Number(rotting),
      allowChannelMove: allowMove,
      timelineShowsWhatsappMessages: showMessages,
    };
    setConflict(false);
    const result = await action.run(
      () => putSettings(token as string, ws, body),
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          setConflict(true);
          return '';
        }
        return 'Could not save the settings. Try again.';
      },
    );
    if (result) {
      loaded.setData((d) => d && { ...d, settings: result });
      setSaved(true);
    }
  };

  return (
    <Form id="crm-general" onSubmit={onSubmit} isWidthLimited>
      {conflict && <ConflictAlert onReload={() => loaded.reload()} />}
      {action.error && <Alert variant="danger" isInline title={action.error} />}
      {saved && <Alert variant="success" isInline title="Settings saved" />}
      <FormGroup label="Default currency" fieldId="crm-currency">
        <TextInput
          id="crm-currency"
          value={currency}
          maxLength={3}
          isDisabled={!canManage}
          validated={currencyOk ? 'default' : 'error'}
          onChange={(_e, v) => setCurrency(v.toUpperCase())}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant={currencyOk ? 'default' : 'error'}>
              Three letters, for example INR or USD.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
      <FormGroup label="Default pipeline" fieldId="crm-default-pipeline">
        <FormSelect
          id="crm-default-pipeline"
          value={pipelineId}
          isDisabled={!canManage}
          onChange={(_e, v) => setPipelineId(v)}
        >
          {pipelineId === '' && <FormSelectOption value="" label="Not set" />}
          {active.map((p) => (
            <FormSelectOption key={p.id} value={p.id} label={p.name} />
          ))}
        </FormSelect>
      </FormGroup>
      <FormGroup label="Deal rotting days" fieldId="crm-rotting">
        <TextInput
          id="crm-rotting"
          type="number"
          min={1}
          max={365}
          value={rotting}
          isDisabled={!canManage}
          validated={rottingOk ? 'default' : 'error'}
          onChange={(_e, v) => setRotting(v)}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant={rottingOk ? 'default' : 'error'}>
              Days without activity before a deal is marked as rotting, from 1 to 365. Leave empty for never.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
      <FormGroup role="group" fieldId="crm-switches">
        <Switch
          id="crm-allow-move"
          label="Allow moving CRM contacts to another WhatsApp number"
          isChecked={allowMove}
          isDisabled={!canManage}
          onChange={(_e, v) => setAllowMove(v)}
        />
      </FormGroup>
      <FormGroup role="group" fieldId="crm-show-messages">
        <Switch
          id="crm-show-messages"
          label="Show WhatsApp messages on timelines"
          isChecked={showMessages}
          isDisabled={!canManage}
          onChange={(_e, v) => setShowMessages(v)}
        />
      </FormGroup>
      {canManage && (
        <ActionGroup>
          <Button
            type="submit"
            variant="primary"
            isDisabled={!currencyOk || !rottingOk || action.busy}
            isLoading={action.busy}
          >
            Save
          </Button>
        </ActionGroup>
      )}
    </Form>
  );
};
