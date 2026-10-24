import type { CurrentUser, WorkspaceAccess } from '@app/api/users';
import { SESSION_KEY } from '@app/session/sessionStore';
import type { MockRoute } from './fetchMock';

const PLATFORM_CODES = [
  'platform-user:manage',
  'customer:view',
  'customer:create',
  'customer:manage',
  'whatsapp:bridge',
  'phone-number:view-all',
  'phone-number:manage-all',
];
export const BRAND_CODES = [
  'workspace:settings',
  'user:view',
  'user:manage',
  'user:enable',
  'team:manage',
  'phone-number:view',
  'phone-number:manage',
  'contact:view',
  'contact:annotate',
  'contact:edit',
  'contact:import',
  'contact:export',
  'contact:bulk',
  'contact:delete',
  'contact-field:manage',
  'template:view',
  'template:manage',
  'inbox:view',
  'inbox:view-queue',
  'inbox:view-team',
  'inbox:view-all',
  'inbox:send',
  'inbox:assign',
  'inbox:settings',
  'campaign:view',
  'campaign:manage',
  'campaign:settings',
  'crm:view',
  'crm:view-all',
  'crm:edit',
  'crm:delete',
  'crm:settings',
  'crm:export',
];

const base = {
  email: 'me@example.in',
  mobileNumber: '9928088743',
  twoFactorEnabled: false,
  superAdmin: false,
  customer: null,
  role: null,
  authorities: [] as string[],
  workspaces: [] as WorkspaceAccess[],
  mustChangePassword: false,
  availability: { status: 'AVAILABLE' as const, at: null },
};

export const SUPER_ADMIN: CurrentUser = {
  ...base,
  id: 'u1',
  name: 'Nagesh Kumar',
  username: 'nageshk',
  superAdmin: true,
  role: { id: 'r-sa', name: 'SUPER_ADMIN' },
  authorities: PLATFORM_CODES,
};

export const ACCOUNT_MANAGER: CurrentUser = {
  ...base,
  id: 'u2',
  name: 'Asha Manager',
  username: 'asha',
  role: { id: 'r-am', name: 'ACCOUNT_MANAGER' },
  authorities: [
    'customer:view',
    'customer:create',
    'customer:manage',
    'phone-number:view-all',
    'phone-number:manage-all',
    'crm:enable',
  ],
};

export const BRAND_A: WorkspaceAccess = { id: 'w1', name: 'Brand A', role: null, authorities: BRAND_CODES };
export const BRAND_B: WorkspaceAccess = { id: 'w2', name: 'Brand B', role: null, authorities: BRAND_CODES };

export const CUSTOMER_ADMIN: CurrentUser = {
  ...base,
  id: 'u3',
  name: 'Ravi Owner',
  username: 'ravi',
  customer: { id: 'c1', name: 'Acme' },
  role: { id: 'r-ca', name: 'CUSTOMER_ADMIN' },
  authorities: ['workspace:create', 'workspace:enable', 'company-user:manage'],
  workspaces: [BRAND_A, BRAND_B],
};

export const WORKSPACE_MANAGER: CurrentUser = {
  ...base,
  id: 'u4',
  name: 'Meera Manager',
  username: 'meera',
  customer: { id: 'c1', name: 'Acme' },
  workspaces: [{ ...BRAND_A, role: { id: 'r-wm', name: 'WORKSPACE_MANAGER' } }],
};

/** A custom view-only role in Brand A: sees users, numbers, contacts, templates and campaigns, changes nothing. */
export const BRAND_VIEWER: CurrentUser = {
  ...base,
  id: 'u6',
  name: 'Tara Viewer',
  username: 'tara',
  customer: { id: 'c1', name: 'Acme' },
  workspaces: [
    {
      ...BRAND_A,
      role: { id: 'r-viewer', name: 'VIEWER' },
      authorities: [
        'user:view',
        'phone-number:view',
        'contact:view',
        'contact:annotate',
        'contact:edit',
        'contact:import',
        'contact:export',
        'contact:bulk',
        'template:view',
        'template:manage',
        'campaign:view',
        'campaign:manage',
        'inbox:view',
        'inbox:view-queue',
        'inbox:send',
      ],
    },
  ],
};

/** An agent in Brand A with the spec's defaults: own chats plus the team queue, view and annotate contacts. */
export const AGENT_IN_BRAND: CurrentUser = {
  ...base,
  id: 'u7',
  name: 'Ishaan Agent',
  username: 'ishaan',
  customer: { id: 'c1', name: 'Acme' },
  workspaces: [
    {
      ...BRAND_A,
      role: { id: 'r-ag', name: 'AGENT' },
      authorities: [
        'contact:view',
        'contact:annotate',
        'template:view',
        'campaign:view',
        'inbox:view',
        'inbox:view-queue',
        'inbox:send',
        'crm:view',
        'crm:edit',
      ],
    },
  ],
};

export const AGENT_NO_BRANDS: CurrentUser = {
  ...base,
  id: 'u5',
  name: 'Arun Agent',
  username: 'arun',
  customer: { id: 'c1', name: 'Acme' },
};

export const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

/** Stores a session as if the user had logged in earlier; returns its token. */
export function storeSession(token = 'stored-token', expiresAt = inMs(3600_000)): string {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
  return token;
}

/** The GET /api/users/me route answering with {@code user} (default: the super admin). */
export function meRoute(user: Partial<CurrentUser> = {}): Record<string, MockRoute> {
  return { 'GET /api/users/me': { status: 200, body: { ...SUPER_ADMIN, ...user } } };
}

/** The GET /api/users/me route answering with exactly {@code user}. */
export function meAs(user: CurrentUser): Record<string, MockRoute> {
  return { 'GET /api/users/me': { status: 200, body: user } };
}
