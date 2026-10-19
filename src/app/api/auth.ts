import { apiFetch } from '@app/api/client';

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

type SignedIn = { kind: 'signedIn'; token: string; expiresAt: string };
type PasswordChangeRequired = { kind: 'passwordChangeRequired'; passwordChangeToken: string };

export type LoginResult = SignedIn | PasswordChangeRequired | { kind: 'twoFactorRequired'; twoFactorToken: string };

/** The answer to the code step: signed in, or a new password is needed first. */
export type VerifyResult = SignedIn | PasswordChangeRequired;

interface LoginReply {
  token?: string;
  expiresAt?: string;
  twoFactorRequired?: boolean;
  twoFactorToken?: string;
  passwordChangeRequired?: boolean;
  passwordChangeToken?: string;
}

function finalStep(reply: LoginReply): VerifyResult {
  if (reply.passwordChangeRequired && reply.passwordChangeToken) {
    return { kind: 'passwordChangeRequired', passwordChangeToken: reply.passwordChangeToken };
  }
  return { kind: 'signedIn', token: reply.token as string, expiresAt: reply.expiresAt as string };
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const reply = await apiFetch<LoginReply>('/api/auth/login', { method: 'POST', body: { username, password } });
  if (reply.twoFactorRequired && reply.twoFactorToken) {
    return { kind: 'twoFactorRequired', twoFactorToken: reply.twoFactorToken };
  }
  return finalStep(reply);
}

export async function verifyOtp(twoFactorToken: string, otp: string): Promise<VerifyResult> {
  const reply = await apiFetch<LoginReply>('/api/auth/verify-otp', {
    method: 'POST',
    token: twoFactorToken,
    body: { otp },
  });
  return finalStep(reply);
}

export function setInitialPassword(passwordChangeToken: string, newPassword: string): Promise<IssuedToken> {
  return apiFetch<IssuedToken>('/api/auth/initial-password', {
    method: 'POST',
    token: passwordChangeToken,
    body: { newPassword },
  });
}

export function logout(token: string): Promise<void> {
  return apiFetch<void>('/api/auth/logout', { method: 'POST', token });
}
