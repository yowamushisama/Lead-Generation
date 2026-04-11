import Link from 'next/link';
import { clearAuthCookie } from '@/lib/auth';
import { redirect } from 'next/navigation';

async function logoutAction() {
  'use server';
  await clearAuthCookie();
  redirect('/login');
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white px-4 py-6">
        <div className="mb-8">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            Lead Engine
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 text-sm">
          <NavLink href="/leads">Lead Board</NavLink>
          <NavLink href="/messages">Messages</NavLink>
          <NavLink href="/analytics">Analytics</NavLink>
        </nav>

        <form action={logoutAction} className="mt-auto">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-zinc-50 p-6">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    >
      {children}
    </Link>
  );
}
