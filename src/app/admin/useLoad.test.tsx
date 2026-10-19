import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { useLoad } from '@app/admin/useLoad';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { SUPER_ADMIN, meAs, storeSession } from '../../test/session';

const pending: Record<string, (value: string) => void> = {};
let setKey: (k: string) => void = () => undefined;

const Probe: React.FunctionComponent = () => {
  const [key, setK] = React.useState('a');
  setKey = setK;
  const loaded = useLoad(() => new Promise<string>((resolve) => (pending[key] = resolve)), [key]);
  return <div data-testid="probe">{loaded.data ?? (loaded.loading ? 'loading' : 'none')}</div>;
};

describe('useLoad', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('drops the previous key’s data while the new key loads', async () => {
    mockFetch(meAs(SUPER_ADMIN));
    renderApp('/', <Probe />);
    await screen.findByText('Welcome, Nagesh Kumar');
    await act(async () => pending.a('rows of a'));
    expect(screen.getByTestId('probe')).toHaveTextContent('rows of a');
    act(() => setKey('b'));
    expect(screen.getByTestId('probe')).toHaveTextContent('loading');
    await act(async () => pending.b('rows of b'));
    expect(screen.getByTestId('probe')).toHaveTextContent('rows of b');
  });
});
