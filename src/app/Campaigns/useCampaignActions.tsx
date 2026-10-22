import * as React from 'react';
import { Button } from '@patternfly/react-core';
import type { IAction } from '@patternfly/react-table';
import {
  CampaignAction,
  CampaignStatus,
  CampaignView,
  campaignAction,
  deleteCampaign,
} from '@app/api/campaigns';
import { campaignActionMessage, messageFor } from '@app/api/messages';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

type Act = CampaignAction | 'delete';

const TITLES: Record<Act, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  terminate: 'Terminate',
  delete: 'Delete',
};

const BY_STATUS: Record<CampaignStatus, Act[]> = {
  DRAFT: ['start', 'delete'],
  RUNNING: ['pause', 'terminate'],
  PAUSED: ['resume', 'terminate'],
  COMPLETED: [],
  TERMINATED: [],
};

/**
 * The lifecycle actions of a campaign, as a row menu or as buttons, with the confirmations for the
 * destructive ones. {@code onDone} learns which action succeeded.
 */
export function useCampaignActions(onDone: (action: Act) => void) {
  const { token, workspace } = useSession();
  const canManage = useAccess().hasInWorkspace('campaign:manage');
  const ws = workspace?.id ?? '';
  const [confirming, setConfirming] = React.useState<{ act: 'terminate' | 'delete'; item: CampaignView } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const perform = async (act: Act, item: CampaignView) => {
    setError(null);
    setBusy(true);
    try {
      if (act === 'delete') await deleteCampaign(token as string, ws, item.id);
      else await campaignAction(token as string, ws, item.id, act);
    } catch (e) {
      setError(act === 'delete' ? messageFor(e) : campaignActionMessage(e, act));
      return;
    } finally {
      setBusy(false);
    }
    setConfirming(null);
    onDone(act);
  };

  const choose = (act: Act, item: CampaignView) => {
    if (act === 'terminate' || act === 'delete') {
      setError(null);
      setConfirming({ act, item });
    } else {
      void perform(act, item);
    }
  };

  const actsFor = (c: CampaignView): Act[] => (canManage ? BY_STATUS[c.status] : []);

  const modal = confirming && (
    <ConfirmModal
      title={confirming.act === 'terminate' ? 'Terminate campaign?' : 'Delete draft?'}
      confirmLabel={TITLES[confirming.act]}
      variant="danger"
      busy={busy}
      error={error}
      onConfirm={() => perform(confirming.act, confirming.item)}
      onCancel={() => {
        setConfirming(null);
        setError(null);
      }}
    >
      {confirming.act === 'terminate'
        ? `Pending messages of ${confirming.item.name} will not be sent. This cannot be undone.`
        : `Delete ${confirming.item.name}? This cannot be undone.`}
    </ConfirmModal>
  );

  return {
    menuFor: (c: CampaignView): IAction[] =>
      actsFor(c).map((act) => ({ title: TITLES[act], onClick: () => choose(act, c) })),
    buttonsFor: (c: CampaignView): React.ReactNode =>
      actsFor(c).map((act) => (
        <Button
          key={act}
          variant={act === 'terminate' || act === 'delete' ? 'danger' : 'secondary'}
          isDisabled={busy}
          onClick={() => choose(act, c)}
        >
          {TITLES[act]}
        </Button>
      )),
    modal,
    /** The last failure, shown by the page; while a confirmation is open the modal shows it instead. */
    error: confirming ? null : error,
  };
}
