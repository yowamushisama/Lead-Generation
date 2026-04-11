'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { signupAction, SignupState } from './actions';

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  required,
  autoComplete,
  hint,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
        {!required && <span className="ml-1 text-xs text-zinc-400">(optional)</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`w-full rounded-md border px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-zinc-300 focus:border-zinc-500 focus:ring-zinc-500'
        }`}
      />
      {hint && !error && <p className="text-xs text-zinc-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signupAction,
    null,
  );

  const e = state?.errors ?? {};

  // Auto-generate slug from org name
  const slugRef = useRef<HTMLInputElement>(null);

  function handleOrgNameChange(ev: React.ChangeEvent<HTMLInputElement>) {
    if (!slugRef.current) return;
    // Only auto-fill if the user hasn't manually edited the slug field
    if (slugRef.current.dataset.touched === 'true') return;
    const slug = ev.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    slugRef.current.value = slug;
  }

  return (
    <form action={action} className="space-y-4">
      {e.form && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {e.form}
        </p>
      )}

      {/* Account */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Account
        </p>
        <Field
          id="name"
          label="Full name"
          placeholder="Jane Smith"
          autoComplete="name"
          error={e.name}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          required
          placeholder="you@company.com"
          autoComplete="email"
          error={e.email}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          required
          placeholder="Min 8 characters"
          autoComplete="new-password"
          hint="At least 8 characters"
          error={e.password}
        />
        <Field
          id="confirmPassword"
          label="Confirm password"
          type="password"
          required
          placeholder="Repeat password"
          autoComplete="new-password"
          error={e.confirmPassword}
        />
      </div>

      {/* Organization */}
      <div className="space-y-3 border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Organization
        </p>
        <div className="space-y-1">
          <label htmlFor="organizationName" className="text-sm font-medium text-zinc-700">
            Organization name
          </label>
          <input
            id="organizationName"
            name="organizationName"
            type="text"
            required
            placeholder="Acme Corporation"
            autoComplete="organization"
            onChange={handleOrgNameChange}
            className={`w-full rounded-md border px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 ${
              e.organizationName
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                : 'border-zinc-300 focus:border-zinc-500 focus:ring-zinc-500'
            }`}
          />
          {e.organizationName && (
            <p className="text-xs text-red-500">{e.organizationName}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="organizationSlug" className="text-sm font-medium text-zinc-700">
            Organization slug
          </label>
          <div className="flex items-center rounded-md border border-zinc-300 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 overflow-hidden">
            <span className="select-none bg-zinc-50 px-3 py-2 text-sm text-zinc-400 border-r border-zinc-300">
              app/
            </span>
            <input
              ref={slugRef}
              id="organizationSlug"
              name="organizationSlug"
              type="text"
              required
              placeholder="acme-corp"
              onFocus={() => {
                if (slugRef.current) slugRef.current.dataset.touched = 'true';
              }}
              className="flex-1 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none bg-white"
            />
          </div>
          <p className="text-xs text-zinc-400">
            Lowercase letters, numbers, and hyphens only
          </p>
          {e.organizationSlug && (
            <p className="text-xs text-red-500">{e.organizationSlug}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-60"
      >
        {pending ? 'Creating account...' : 'Create account'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
