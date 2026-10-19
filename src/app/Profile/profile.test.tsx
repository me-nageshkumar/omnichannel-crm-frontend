import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { MockRoute, callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { SUPER_ADMIN, storeSession } from '../../test/session';

const SETUP = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  qrCodeDataUri: 'data:image/png;base64,AAA',
  issuer: 'Omnichannel CRM',
  username: 'nageshk',
};

/** /me answers with each of {@code states} in turn (the last one repeats). */
function meSequence(...states: Array<Partial<typeof SUPER_ADMIN>>): Record<string, MockRoute> {
  let i = 0;
  return {
    'GET /api/users/me': () => ({ status: 200, body: { ...SUPER_ADMIN, ...states[Math.min(i++, states.length - 1)] } }),
  };
}

async function openEnable(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Enable two-factor' }));
  await screen.findByRole('img', { name: 'QR code for two-factor setup' });
}

describe('profile', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession('t1');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows details', async () => {
    mockFetch(meSequence({ mobileNumber: null }));
    renderApp('/profile');
    expect(await screen.findByText('nageshk')).toBeVisible();
    const details = screen.getByRole('region', { name: 'Your details' });
    expect(within(details).getByText('Nagesh Kumar')).toBeVisible();
    expect(within(details).getByText('me@example.in')).toBeVisible();
    expect(within(details).getByText('Super admin')).toBeVisible();
    expect(within(details).getByText('—')).toBeVisible();
  });

  it('shows two-factor off', async () => {
    mockFetch(meSequence({}));
    renderApp('/profile');
    expect(await screen.findByText('Off')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Enable two-factor' })).toBeVisible();
  });

  it('enable shows install help and QR', async () => {
    mockFetch({ ...meSequence({}), 'POST /api/users/me/two-factor/initiate': { status: 200, body: SETUP } });
    const { user } = renderApp('/profile');
    await openEnable(user);
    const appStore = screen.getAllByRole('link', { name: 'App Store' }).map((a) => a.getAttribute('href'));
    const play = screen.getAllByRole('link', { name: 'Google Play' }).map((a) => a.getAttribute('href'));
    expect(appStore).toEqual([
      'https://apps.apple.com/app/google-authenticator/id388497605',
      'https://apps.apple.com/app/microsoft-authenticator/id983156458',
    ]);
    expect(play).toEqual([
      'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2',
      'https://play.google.com/store/apps/details?id=com.azure.authenticator',
    ]);
    screen.getAllByRole('link', { name: /App Store|Google Play/ }).forEach((a) => {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    });
    expect(screen.getByRole('img', { name: 'QR code for two-factor setup' })).toHaveAttribute('src', SETUP.qrCodeDataUri);
    await user.click(screen.getByRole('button', { name: "Can't scan the code?" }));
    expect(screen.getByDisplayValue('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeVisible();
    expect(screen.getAllByText('Omnichannel CRM').length).toBeGreaterThan(0);
  });

  it('wrong code shows error and keeps the session', async () => {
    mockFetch({
      ...meSequence({}),
      'POST /api/users/me/two-factor/initiate': { status: 200, body: SETUP },
      'POST /api/users/me/two-factor/confirm': { status: 400, body: { code: 'INVALID_OTP', message: 'x' } },
    });
    const { user } = renderApp('/profile');
    await openEnable(user);
    await user.type(screen.getByLabelText(/6-digit code/), '000000');
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByText('That code is not valid. Try again.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  it('confirm turns two-factor on', async () => {
    const fetch = mockFetch({
      ...meSequence({}, { twoFactorEnabled: true }),
      'POST /api/users/me/two-factor/initiate': { status: 200, body: SETUP },
      'POST /api/users/me/two-factor/confirm': { status: 204 },
    });
    const { user } = renderApp('/profile');
    await openEnable(user);
    await user.type(screen.getByLabelText(/6-digit code/), '123456');
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByText('Two-factor authentication is on.')).toBeVisible();
    expect(screen.getByText('On')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Disable two-factor' })).toBeVisible();
    expect(requestTo(fetch, 'POST /api/users/me/two-factor/confirm')?.body).toEqual({ secret: SETUP.secret, otp: '123456' });
  });

  it('cancel closes the panel without saving', async () => {
    const fetch = mockFetch({ ...meSequence({}), 'POST /api/users/me/two-factor/initiate': { status: 200, body: SETUP } });
    const { user } = renderApp('/profile');
    await openEnable(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Enable two-factor' })).toBeVisible();
    expect(screen.queryByRole('img', { name: 'QR code for two-factor setup' })).toBeNull();
    expect(callsTo(fetch, 'POST /api/users/me/two-factor/confirm')).toBe(0);
  });

  it('lockout message', async () => {
    mockFetch({
      ...meSequence({}),
      'POST /api/users/me/two-factor/initiate': { status: 200, body: SETUP },
      'POST /api/users/me/two-factor/confirm': {
        status: 429,
        body: { code: 'TOO_MANY_ATTEMPTS', message: 'x', retryAfterSeconds: 600 },
      },
    });
    const { user } = renderApp('/profile');
    await openEnable(user);
    await user.type(screen.getByLabelText(/6-digit code/), '123456');
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByText('Too many attempts. Try again in 10 minutes.')).toBeVisible();
  });

  it('disable asks for a code and turns off', async () => {
    const fetch = mockFetch({
      ...meSequence({ twoFactorEnabled: true }, { twoFactorEnabled: false }),
      'POST /api/users/me/two-factor/disable': { status: 204 },
    });
    const { user } = renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Disable two-factor' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/6-digit code/), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Two-factor authentication is off.')).toBeVisible();
    expect(screen.getByText('Off')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(requestTo(fetch, 'POST /api/users/me/two-factor/disable')?.body).toEqual({ otp: '123456' });
  });

  it('disable wrong code keeps modal open', async () => {
    mockFetch({
      ...meSequence({ twoFactorEnabled: true }),
      'POST /api/users/me/two-factor/disable': { status: 400, body: { code: 'INVALID_OTP', message: 'x' } },
    });
    const { user } = renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Disable two-factor' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/6-digit code/), '000000');
    await user.click(within(dialog).getByRole('button', { name: 'Disable' }));
    expect(await within(dialog).findByText('That code is not valid. Try again.')).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
