'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from './actions';
import {
  LayoutDashboard,
  TableProperties,
  GitBranch,
  Plug,
  MessageSquare,
  MessageCircle,
  Megaphone,
  Target,
  Sparkles,
  BarChart3,
  Activity,
  ShieldCheck,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'OVERVIEW',
    items: [
      { href: '/overview', label: 'Command Center', icon: LayoutDashboard },
    ],
  },
  {
    label: 'ACQUISITION',
    items: [
      { href: '/leads',    label: 'Lead Intelligence', icon: TableProperties },
      { href: '/pipeline', label: 'Pipeline Monitor',  icon: GitBranch },
      { href: '/adapters', label: 'Adapters',          icon: Plug },
    ],
  },
  {
    label: 'OUTREACH',
    items: [
      { href: '/messages',      label: 'Message Queue',  icon: MessageSquare },
      { href: '/conversations', label: 'Conversations',  icon: MessageCircle },
    ],
  },
  {
    label: 'CONFIGURATION',
    items: [
      { href: '/campaigns',      label: 'Campaigns',      icon: Megaphone },
      { href: '/prompt-configs', label: 'Prompt Library', icon: Sparkles },
      { href: '/icp',            label: 'ICP Builder',    icon: Target },
      { href: '/settings',       label: 'AI Settings',    icon: Settings },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/diagnostics', label: 'Diagnostics',  icon: Activity },
      { href: '/compliance',  label: 'Compliance',   icon: ShieldCheck },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-base">
        <div className="relative z-10 min-h-full p-6">{children}</div>
      </main>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative flex w-60 shrink-0 flex-col overflow-y-auto border-r border-ink/[0.06] bg-surface">
      {/* Top ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40"
        style={{ background: 'linear-gradient(to bottom, rgba(124,58,237,0.06), transparent)' }}
      />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-2.5 border-b border-ink/[0.06] px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orchid/20 ring-1 ring-orchid/30">
          <Zap className="h-3.5 w-3.5 text-orchid" />
        </div>
        <div>
          <span className="block font-display text-[13px] font-700 tracking-tight text-ink">
            Obsidian
          </span>
          <span className="block font-mono text-[9px] text-dusk">
            ACQ ENGINE
          </span>
        </div>
        {/* Live dot */}
        <span className="dot-live ml-auto" title="System live" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 space-y-6 px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="section-label mb-1.5 px-2">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href))}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom — logout */}
      <div className="relative z-10 border-t border-ink/[0.06] px-3 py-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-dusk transition-colors hover:bg-ink/[0.04] hover:text-mist"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[13px]">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={[
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
          active
            ? 'bg-aqua/[0.08] text-aqua ring-glow-aqua'
            : 'text-mist hover:bg-ink/[0.04] hover:text-ink',
        ].join(' ')}
      >
        <Icon
          className={[
            'h-3.5 w-3.5 shrink-0 transition-colors',
            active ? 'text-aqua' : 'text-dusk group-hover:text-mist',
          ].join(' ')}
        />
        <span className="truncate">{label}</span>
        {active && (
          <span className="ml-auto h-1 w-1 rounded-full bg-aqua" />
        )}
      </Link>
    </li>
  );
}
