import { apiFetch } from '@app/api/client';

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

export type LoginResult =
  | { kind: 'signedIn'; token: string; expiresAt: string }
  | { kind: 'twoFactorRequired'; twoFactorToken: string };

interface LoginReply {
  token?: string;
  expiresAt?: string;
  twoFactorRequired?: boolean;
  twoFactorToken?: string;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const reply = await apiFetch<LoginReply>('/api/auth/login', { method: 'POST', body: { username, password } });
  if (reply.twoFactorRequired && reply.twoFactorToken) {
    return { kind: 'twoFactorRequired', twoFactorToken: reply.twoFactorToken };
  }
  return { kind: 'signedIn', token: reply.token as string, expiresAt: reply.expiresAt as string };
}

export function verifyOtp(twoFactorToken: string, otp: string): Promise<IssuedToken> {
  return apiFetch<IssuedToken>('/api/auth/verify-otp', { method: 'POST', token: twoFactorToken, body: { otp } });
}

export function logout(token: string): Promise<void> {
  return apiFetch<void>('/api/auth/logout', { method: 'POST', token });
}
