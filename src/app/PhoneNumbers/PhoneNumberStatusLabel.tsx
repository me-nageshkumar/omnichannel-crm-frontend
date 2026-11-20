import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { CLOUD_STATE_LABELS, CloudState, PhoneNumber, PhoneNumberStatus, shown } from '@app/api/phoneNumbers';
import { disabledText } from '@app/api/enablement';

const BECAUSE = { NUMBER: 'number', BRAND: 'brand', CUSTOMER: 'company' } as const;

const COLORS: Record<PhoneNumberStatus, 'green' | 'blue' | 'orange' | 'red' | 'grey'> = {
  CONNECTED: 'green',
  WAITING_FOR_LOGIN: 'blue',
  NOT_CONNECTED_YET: 'grey',
  DISCONNECTED: 'orange',
  WRONG_NUMBER: 'red',
  DISABLED: 'grey',
  ARCHIVED: 'grey',
};

/** "5 minutes ago", "2 days ago". */
export function relative(iso: string, now = Date.now()): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const units: Array<[number, string]> = [
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, name] of units) {
    if (secs >= size) {
      const n = Math.floor(secs / size);
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

const CLOUD_COLORS: Record<CloudState, 'green' | 'blue' | 'orange' | 'red'> = {
  READY: 'green',
  WAITING_FOR_WEBHOOK: 'blue',
  NOT_REGISTERED: 'orange',
  TOKEN_INVALID: 'red',
};

/** A Cloud number shows Meta's side, unless it is disabled or archived. */
const cloudState = (n: PhoneNumber): CloudState | null =>
  n.cloud && n.status !== 'DISABLED' && n.status !== 'ARCHIVED' ? n.cloud.state : null;

export function statusText(n: PhoneNumber): string {
  const cloud = cloudState(n);
  if (cloud) return CLOUD_STATE_LABELS[cloud];
  switch (n.status) {
    case 'DISABLED':
      return `Disabled (${BECAUSE[n.disabledBecause ?? 'NUMBER']})`;
    case 'NOT_CONNECTED_YET':
      return 'Not connected yet';
    case 'WAITING_FOR_LOGIN':
      return 'Waiting for WhatsApp login';
    case 'CONNECTED':
      return 'Connected';
    case 'WRONG_NUMBER':
      return n.wrongNumber ? `Wrong number: ${shown(n.wrongNumber)}` : 'Wrong number';
    case 'DISCONNECTED':
      return n.lastSeenAt ? `Disconnected · last seen ${relative(n.lastSeenAt)}` : 'Disconnected';
    case 'ARCHIVED':
      return 'Archived';
  }
}

/** The number's connection status; a number disabled itself names who did it on hover. */
export const PhoneNumberStatusLabel: React.FunctionComponent<{ number: PhoneNumber }> = ({ number }) => {
  const cloud = cloudState(number);
  const label = <Label color={cloud ? CLOUD_COLORS[cloud] : COLORS[number.status]}>{statusText(number)}</Label>;
  if (cloud && number.cloud?.lastError) {
    return <Tooltip content={number.cloud.lastError}>{React.cloneElement(label, { tabIndex: 0 })}</Tooltip>;
  }
  if (number.status === 'DISABLED' && number.disabledBecause === 'NUMBER' && number.disabled) {
    return <Tooltip content={disabledText(number.disabled)}>{React.cloneElement(label, { tabIndex: 0 })}</Tooltip>;
  }
  return label;
};

const PLAIN_TEXT: Record<PhoneNumberStatus, string> = {
  CONNECTED: 'Connected',
  WAITING_FOR_LOGIN: 'Waiting for WhatsApp login',
  NOT_CONNECTED_YET: 'Not connected yet',
  DISCONNECTED: 'Disconnected',
  WRONG_NUMBER: 'Wrong number',
  DISABLED: 'Disabled',
  ARCHIVED: 'Archived',
};

/** A bare connection status, for lists that only know the status. */
export const PhoneStatusLabel: React.FunctionComponent<{ status: PhoneNumberStatus }> = ({ status }) => (
  <Label color={COLORS[status]}>{PLAIN_TEXT[status]}</Label>
);
