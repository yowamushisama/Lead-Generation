'use server';

import { redirect } from 'next/navigation';
import { setAuthCookie } from '@/lib/auth';
import { auth } from '@/lib/api-client';

export type LoginState = { error: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const res = await auth.login(email, password);
    await setAuthCookie(res.accessToken);
  } catch {
    return { error: 'Invalid email or password' };
  }

  redirect('/leads');
}
