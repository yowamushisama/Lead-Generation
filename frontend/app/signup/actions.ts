'use server';

import { redirect } from 'next/navigation';
import { setAuthCookie } from '@/lib/auth';
import { auth, ApiError } from '@/lib/api-client';

export type SignupState = { errors: Partial<Record<SignupField, string>> } | null;

export type SignupField =
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'name'
  | 'organizationName'
  | 'organizationSlug'
  | 'form';

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = (formData.get('email') as string).trim();
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const name = (formData.get('name') as string).trim() || undefined;
  const organizationName = (formData.get('organizationName') as string).trim();
  const organizationSlug = (formData.get('organizationSlug') as string).trim();

  // Client-side-style validation on the server to avoid a round-trip for obvious errors
  const errors: Partial<Record<SignupField, string>> = {};

  if (!email) errors.email = 'Email is required';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (!organizationName) errors.organizationName = 'Organization name is required';
  if (!organizationSlug) errors.organizationSlug = 'Organization slug is required';
  else if (!/^[a-z0-9-]+$/.test(organizationSlug))
    errors.organizationSlug = 'Only lowercase letters, numbers, and hyphens';

  if (Object.keys(errors).length > 0) return { errors };

  try {
    const res = await auth.register({
      email,
      password,
      name,
      organizationName,
      organizationSlug,
    });
    await setAuthCookie(res.accessToken);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        const msg = err.message.toLowerCase();
        if (msg.includes('slug')) {
          return { errors: { organizationSlug: 'Slug is already taken' } };
        }
        return { errors: { email: 'An account with this email already exists' } };
      }
      return { errors: { form: 'Registration failed. Please try again.' } };
    }
    return { errors: { form: 'An unexpected error occurred.' } };
  }

  redirect('/leads');
}
