import * as React from 'react';
import { Alert, Switch } from '@patternfly/react-core';
import { messageFor } from '@app/api/messages';
import { setAvailability } from '@app/api/users';
import { useSession } from '@app/session/SessionContext';

/**
 * The agent's own Available / Away switch (design §3.2). Routing and stickiness skip agents who are Away. Shown
 * only to brand users who can open an inbox somewhere; a failed save puts the switch back and says why.
 */
export const AvailabilitySwitch: React.FunctionComponent = () => {
  const { token, user, setUser } = useSession();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!user || !token || !user.customer) return null;
  if (!user.workspaces.some((w) => w.authorities.includes('inbox:view'))) return null;
  const available = user.availability.status === 'AVAILABLE';

  const flip = async (checked: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setUser(await setAvailability(token, checked ? 'AVAILABLE' : 'AWAY'));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Switch
        id="availability-switch"
        aria-label="Availability"
        label={available ? 'Available' : 'Away'}
        isChecked={available}
        isDisabled={busy}
        onChange={(_e, checked) => void flip(checked)}
      />
      {error && (
        <Alert variant="danger" isInline isPlain title={error} style={{ position: 'absolute', zIndex: 1 }} />
      )}
    </>
  );
};
