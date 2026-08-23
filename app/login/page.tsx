'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Btn, MarketingShell, MicroLabel } from '@/components/ui';

const SAMPLE_ACCOUNTS = [
  { username: 'tmadmin', password: 'tmadmin123', label: 'Admin — sees the Admin section' },
  { username: 'tmanalyst', password: 'tmanalyst123', label: 'Analyst — Admin section hidden' },
];

const NEXT_STEPS = [
  {
    step: '01',
    title: 'Upload a tender',
    body: 'Drop in a contract, specification or bill of quantities. Text is extracted and the document is classified automatically.',
  },
  {
    step: '02',
    title: 'Four agents review it',
    body: 'Legal, engineering and commercial assessments run together, then risk aggregates them into one decision.',
  },
  {
    step: '03',
    title: 'Decide with the evidence',
    body: 'You get a bid / no-bid recommendation, a target price with its margin, and the specific factors behind both.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login } = useAuth();
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

  const inputClass =
    'w-full bg-panel border border-line px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-line-strong';

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

              <Btn type="submit" variant="accent" className="w-full">
                Sign in
              </Btn>
            </form>

            <div className="mt-10 border-t border-line pt-6">
              <MicroLabel className="mb-4">Demo accounts</MicroLabel>
              <div className="border border-line">
                {SAMPLE_ACCOUNTS.map((account, i) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => fillSample(account)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-ink-08 transition-colors ${
                      i > 0 ? 'border-t border-line' : ''
                    }`}
                  >
                    <div className="font-mono text-[13px]">
                      {account.username} / {account.password}
                    </div>
                    <div className="text-[11.5px] text-ink-45 mt-1">{account.label}</div>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] text-ink-45">Click an account to fill the form.</p>
            </div>
          </div>

          {/* What happens next */}
          <aside>
            <MicroLabel className="mb-4">What happens next</MicroLabel>
            <div className="grid gap-px bg-line border border-line">
              {NEXT_STEPS.map((s) => (
                <div key={s.step} className="bg-panel px-5 py-5">
                  <div className="font-mono text-[11px] text-accent">{s.step}</div>
                  <div className="text-[14px] font-semibold mt-2">{s.title}</div>
                  <p className="text-[12.5px] leading-[1.6] text-ink-60 mt-2">{s.body}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </MarketingShell>
  );
}
