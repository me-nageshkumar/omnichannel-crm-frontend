import type { Authority, NeedsCreating } from '@app/api/authorities';

/** An authority as the server lists it; defaults to an active, unheld platform authority. */
export function authority(code: string, over: Partial<Authority> = {}): Authority {
  return {
    code,
    group: code.split(':')[0],
    level: 'PLATFORM',
    description: `Does ${code}`,
    builtIn: false,
    status: 'ACTIVE',
    checkedIn: [],
    roles: [],
    updatedAt: null,
    updatedBy: null,
    ...over,
  };
}

export const AUTHORITY_LIST: Authority[] = [
  authority('customer:create', { builtIn: true, description: 'Create a customer', roles: ['ACCOUNT_MANAGER'] }),
  authority('customer:view', {
    builtIn: true,
    description: 'See the customer list and details',
    roles: ['ACCOUNT_MANAGER'],
  }),
  authority('order:refnd', { level: 'BRAND', status: 'NOT_CHECKED', description: 'Refund an order' }),
  authority('report:run', { status: 'WRONG_LEVEL', description: 'Run a report' }),
  authority('user:manage', { builtIn: true, level: 'BRAND', description: 'Create users in the workspace' }),
];

export const PROBE: NeedsCreating = {
  code: 'test:probe',
  suggestedLevel: null,
  suggestedGroup: 'test',
  checkedIn: ['ProbeController.probe'],
};
