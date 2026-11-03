import { getAutomationOptions } from '@app/api/automations';
import type { AutomationOptions } from '@app/api/automations';
import { type Loaded, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

/** Everything the rule editor offers (numbers, agents, teams, templates, the CRM's pipelines), for the brand. */
export function useAutomationOptions(): Loaded<AutomationOptions> {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  return useLoad((tk) => getAutomationOptions(tk, ws), [ws]);
}
