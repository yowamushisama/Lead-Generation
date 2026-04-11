'use server';

import { cookies } from 'next/headers';

const TOKEN_COOKIE = 'auth_token';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, token, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}

export async function getAuthToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(TOKEN_COOKIE)?.value ?? null;
}
