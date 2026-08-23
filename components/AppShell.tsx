'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { DEMO_WORKSPACE } from '@/lib/demo-data';

interface NavItem {
  href: string;
  label: string;
  /** Right-aligned mono count. `live` items fill from the database. */
  badge?: string;
  live?: 'bids';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/memory', label: 'Company Memory', badge: DEMO_WORKSPACE.factCount },
  { href: '/tenders', label: 'Tenders' },
  { href: '/bids', label: 'Bid Pipeline', live: 'bids' },
  { href: '/commercial', label: 'Commercial' },
  { href: '/legal', label: 'Legal', badge: DEMO_WORKSPACE.legalCount },
  { href: '/sources', label: 'Sources', badge: DEMO_WORKSPACE.sourceCount },
  { href: '/team', label: 'Team', badge: DEMO_WORKSPACE.teamCount },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Default Cost Items' },
  { href: '/admin/models', label: 'Model Management' },
  { href: '/admin/company-context', label: 'Company Context' },
];

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Gate this page's content on the sample admin role (see lib/auth.tsx) -
   * used by the /admin pages so a tmanalyst user hitting the URL directly
   * (nav being hidden isn't enough) sees an access-denied panel instead of
   * the actual page content. */
  requireAdmin?: boolean;
  children: ReactNode;
}

/** Workspace chrome: a full-height sidebar plus the page header rendered
 * inside the content column (the design has no topbar - the page title is
 * part of the page, under a mono eyebrow).
 *
 * Also owns the sample-auth gate: redirects signed-out visitors to the
 * marketing page, and only renders the Admin nav section for the logged-in
 * role (lib/auth.tsx - tmadmin vs tmanalyst). */
export default function AppShell({
  title,
  subtitle,
  actions,
  requireAdmin,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [bidCount, setBidCount] = useState<string | undefined>();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !user) router.replace('/welcome');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/bids?limit=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBidCount(String(d.bids?.length ?? 0)))
      .catch(() => {});
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="micro tm-pulse">Loading workspace</div>
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href;
    const badge = item.live === 'bids' ? bidCount : item.badge;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center justify-between gap-3 px-3 py-2 text-[13.5px] transition-colors ${
          active
            ? 'bg-ink-08 text-ink font-semibold'
            : 'text-ink-60 hover:text-ink hover:bg-ink-08'
        }`}
      >
        <span className="truncate">{item.label}</span>
        {badge ? <span className="font-mono text-[11px] text-ink-45">{badge}</span> : null}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-cream text-ink flex">
      <aside className="w-[236px] shrink-0 border-r border-line flex flex-col fixed inset-y-0 left-0 z-20 bg-cream">
        <div className="px-5 h-[68px] flex items-center gap-2">
          <span className="text-[17px] font-semibold tracking-[-0.02em]">TenderMind</span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block" />
        </div>

        <div className="px-4 pb-4">
          <div className="border border-line px-3.5 py-3">
            <div className="text-[13px] font-medium truncate">{DEMO_WORKSPACE.company}</div>
            <div className="text-[11.5px] text-ink-45 mt-0.5">{DEMO_WORKSPACE.plan}</div>
          </div>
        </div>

        <nav className="flex-1 px-2 overflow-y-auto">
          <div className="space-y-0.5">{NAV_ITEMS.map(renderNavItem)}</div>

          {isAdmin && (
            <>
              <div className="micro px-3 pt-6 pb-2">Admin</div>
              <div className="space-y-0.5">{ADMIN_NAV_ITEMS.map(renderNavItem)}</div>
            </>
          )}
        </nav>

        <div className="border-t border-line px-2 py-3 space-y-0.5">
          <Link
            href="/settings"
            className="block px-3 py-2 text-[13px] text-ink-60 hover:text-ink hover:bg-ink-08 transition-colors"
          >
            Settings &amp; integrations
          </Link>
          <Link
            href="/welcome"
            className="block px-3 py-2 text-[13px] text-ink-60 hover:text-ink hover:bg-ink-08 transition-colors"
          >
            Marketing site
          </Link>

          <div className="flex items-center gap-3 px-3 pt-3">
            <div className="h-9 w-9 shrink-0 bg-ink text-cream flex items-center justify-center font-mono text-[11px]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{user.name}</p>
              <p className="text-[11.5px] text-ink-45 capitalize truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.replace('/welcome');
            }}
            className="w-full text-left px-3 py-1.5 text-[11.5px] text-ink-45 hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-[236px] min-w-0 px-10 py-9">
        <div className="border-b border-line pb-6 mb-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              {subtitle ? <div className="micro mb-2">{subtitle}</div> : null}
              <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">
                {title}
              </h1>
            </div>
            {actions ? <div className="flex items-center gap-3 shrink-0">{actions}</div> : null}
          </div>
        </div>

        {requireAdmin && !isAdmin ? (
          <div className="border border-line bg-panel px-8 py-10 max-w-xl">
            <div className="micro mb-3">Access restricted</div>
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Admin accounts only</h2>
            <p className="text-[13px] leading-[1.65] text-ink-72 mt-3">
              This page is only available to admin accounts. You are signed in as{' '}
              <span className="font-medium">{user.name}</span> ({user.role}).
            </p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
