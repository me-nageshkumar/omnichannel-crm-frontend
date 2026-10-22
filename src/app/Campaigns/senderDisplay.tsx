import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { SenderState, SenderView } from '@app/api/campaigns';

const STATE: Record<SenderState, { text: string; color: 'blue' | 'green' | 'orange' | 'red' | 'grey' }> = {
  WARMING: { text: 'Warming', color: 'blue' },
  ACTIVE: { text: 'Active', color: 'green' },
  RESTING: { text: 'Resting', color: 'orange' },
  SUSPENDED: { text: 'Suspended', color: 'red' },
  RETIRED: { text: 'Retired', color: 'grey' },
};

/** The sender's lifecycle state; a resting sender says when it rests until. */
export const SenderStateLabel: React.FunctionComponent<{ sender: SenderView }> = ({ sender }) => {
  const { text, color } = STATE[sender.state];
  const until =
    sender.state === 'RESTING' && sender.restUntil
      ? ` rests until ${new Date(sender.restUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
      : '';
  return <Label color={color}>{text + until}</Label>;
};

/** Why the sender is slowed or paused, or null when it runs normally. */
export function pauseText(s: SenderView, now = Date.now()): string | null {
  const parts: string[] = [];
  if (s.pausedUntil && new Date(s.pausedUntil).getTime() > now) {
    parts.push(
      s.pauseReason === 'UNDELIVERED_RUN'
        ? 'Paused: last messages not delivered'
        : s.pauseReason === 'LOOKUP_FAILED'
          ? 'Paused: could not check numbers'
          : 'Paused',
    );
  }
  if (s.lowReplyRate) parts.push('Low reply rate, cap halved');
  if (s.halfPaceUntil && new Date(s.halfPaceUntil).getTime() > now) parts.push('Half pace after a logout');
  return parts.length > 0 ? parts.join(' · ') : null;
}
