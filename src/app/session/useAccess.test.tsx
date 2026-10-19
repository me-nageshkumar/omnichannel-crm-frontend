import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { useAccess } from '@app/session/useAccess';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { CUSTOMER_ADMIN, SUPER_ADMIN, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const Probe: React.FunctionComponent<{ code: string }> = ({ code }) => {
  const access = useAccess();
  return (
    <div data-testid="probe">
      {`has=${access.has(code)} inWorkspace=${access.hasInWorkspace(code)} superAdmin=${access.superAdmin}`}
    </div>
  );
};

describe('useAccess', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('has reads the user authorities', async () => {
    storeSession();
    mockFetch(meAs(CUSTOMER_ADMIN));
    renderApp('/', <Probe code="workspace:create" />);
    expect(await screen.findByText('Welcome, Ravi Owner')).toBeVisible();
    expect(screen.getByTestId('probe')).toHaveTextContent('has=true inWorkspace=false superAdmin=false');
  });

  it('hasInWorkspace reads the current workspace', async () => {
    storeSession();
    mockFetch(meAs(WORKSPACE_MANAGER));
    renderApp('/', <Probe code="user:manage" />);
    expect(await screen.findByText('Welcome, Meera Manager')).toBeVisible();
    expect(screen.getByTestId('probe')).toHaveTextContent('has=false inWorkspace=true');
  });

  it('super admin has platform codes only', async () => {
    storeSession();
    mockFetch(meAs(SUPER_ADMIN));
    renderApp('/', <Probe code="workspace:create" />);
    expect(await screen.findByText('Welcome, Nagesh Kumar')).toBeVisible();
    expect(screen.getByTestId('probe')).toHaveTextContent('has=false inWorkspace=false superAdmin=true');
  });
});
