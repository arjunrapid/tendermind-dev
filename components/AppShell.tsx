'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/bids', label: 'Bid History', icon: '📋' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Default Cost Items', icon: '💰' },
  { href: '/admin/models', label: 'Model Management', icon: '🧠' },
  { href: '/admin/company-context', label: 'Company Context', icon: '📚' },
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

/** Shared sidebar + topbar dashboard shell, used by every page instead of
 * each page rendering its own full-width gradient header. Modeled on the
 * common "admin dashboard" layout pattern (fixed left nav + topbar + card
 * content area) rather than a single-column landing-page layout.
 *
 * Also owns the sample-auth gate: redirects to /login when signed out, and
 * only renders the Admin nav section / avatar menu for the logged-in role
 * (lib/auth.tsx - tmadmin vs tmanalyst). */
export default function AppShell({ title, subtitle, actions, requireAdmin, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isActive = (href: string) => pathname === href;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600" />
      </div>
    );
  }

  const renderNavItem = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive(item.href)
          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      <span className="text-base leading-none">{item.icon}</span>
      {item.label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <aside className="w-64 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            T
          </div>
          <span className="font-bold text-gray-900 dark:text-gray-100">Tendermind</span>
        </div>

        <nav className="flex-1 px-3 py-6 overflow-y-auto">
          <div className="space-y-1">{NAV_ITEMS.map(renderNavItem)}</div>

          {isAdmin && (
            <>
              <p className="px-3 pt-6 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                Admin
              </p>
              <div className="space-y-1">{ADMIN_NAV_ITEMS.map(renderNavItem)}</div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400 shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="mt-3 w-full text-left text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="h-9 w-9 rounded-full flex items-center justify-center text-base border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {actions}
            <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8 min-w-0">
          {requireAdmin && !isAdmin ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 text-center max-w-lg">
              <div className="text-4xl mb-3">🔒</div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Access restricted</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                This page is only available to admin accounts. You&apos;re signed in as{' '}
                <span className="font-medium">{user.name}</span> ({user.role}).
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
