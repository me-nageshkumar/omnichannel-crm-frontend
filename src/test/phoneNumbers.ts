import type { PhoneNumber } from '@app/api/phoneNumbers';

/** A phone number view as the API returns it, with sensible defaults. */
export function phoneNumber(over: Partial<PhoneNumber> & Pick<PhoneNumber, 'id' | 'number'>): PhoneNumber {
  return {
    label: null,
    connectionType: 'WHATSAPP_WEB',
    customerId: 'c1',
    customerName: 'Acme',
    workspaceId: 'w1',
    workspaceName: 'Brand A',
    status: 'NOT_CONNECTED_YET',
    disabled: null,
    disabledBecause: null,
    lastConnectedAt: null,
    lastSeenAt: null,
    wrongNumber: null,
    wrongNumberAt: null,
    hasDevice: false,
    creationTime: '2026-10-20T10:00:00Z',
    ...over,
  };
}
