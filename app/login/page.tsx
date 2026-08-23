'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Btn, MarketingShell, MicroLabel } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace('/');
  }, [isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(username, password);
    setIsSubmitting(false);
    if (result.ok) {
      router.replace('/');
    } else {
      setError(result.error || 'Invalid username or password.');
    }
  };

  return (
    <MarketingShell ctaHref="/welcome" ctaLabel="Back to site">
      <section className="max-w-[1180px] mx-auto px-8 py-20">
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Sign-in */}
          <div className="max-w-[440px]">
            <MicroLabel className="mb-4">Workspace access</MicroLabel>
            <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.03em]">
              Sign in to your workspace
            </h1>
            <p className="mt-4 text-[14px] leading-[1.7] text-ink-72">
              This deployment runs with demo accounts so you can try the full analysis pipeline
              without provisioning users.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <div>
                <label className="block text-[12px] text-ink-60 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className={inputClass}
                  placeholder="tmadmin"
                />
              </div>
              <div>
                <label className="block text-[12px] text-ink-60 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
