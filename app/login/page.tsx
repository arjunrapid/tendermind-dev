'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

const SAMPLE_ACCOUNTS = [
  { username: 'tmadmin', password: 'tmadmin123', label: 'Admin - sees the Admin section' },
  { username: 'tmanalyst', password: 'tmanalyst123', label: 'Analyst - Admin section hidden' },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) router.replace('/');
  }, [isLoading, user, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (login(username, password)) {
      router.replace('/');
    } else {
      setError('Invalid username or password.');
    }
  };

  const fillSample = (account: (typeof SAMPLE_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 relative">
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className="absolute top-4 right-4 h-9 w-9 rounded-full flex items-center justify-center text-base border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3">
            T
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tendermind</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="tmadmin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Sample accounts (demo only)
          </p>
          <div className="space-y-2">
            {SAMPLE_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => fillSample(account)}
                className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                  {account.username} / {account.password}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{account.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
