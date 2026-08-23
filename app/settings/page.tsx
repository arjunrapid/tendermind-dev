'use client';

import AppShell from '@/components/AppShell';
import { Btn, MicroLabel, SampleChip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { DEMO_APPROVAL_RULES, DEMO_INTEGRATIONS, DEMO_WORKSPACE } from '@/lib/demo-data';

const TONE_CLASS = { ok: 'text-ok', warn: 'text-warn', muted: 'text-ink-45' } as const;

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <AppShell title="Settings & integrations" subtitle={DEMO_WORKSPACE.company}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {/* Integrations */}
          <section>
            <div className="flex items-center gap-3 border-b border-line pb-3 mb-4">
              <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Document sources</h2>
              <SampleChip />
            </div>
            <div className="border border-line">
              {DEMO_INTEGRATIONS.map((it) => (
                <div
                  key={it.name}
                  className="grid gap-4 md:grid-cols-[minmax(0,1fr)_130px_110px] px-4 py-4 border-b border-line last:border-b-0 items-center"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{it.name}</div>
                    <div className="text-[12px] text-ink-45 mt-1">{it.detail}</div>
                  </div>
                  <div className={`text-[12.5px] font-medium ${TONE_CLASS[it.tone]}`}>
                    {it.status}
                  </div>
                  <div className="micro hover:text-accent cursor-default">{it.action} →</div>
                </div>
              ))}
            </div>
          </section>

          {/* Approval rules */}
          <section className="mt-14">
            <div className="flex items-center gap-3 border-b border-line pb-3 mb-4">
              <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Approval rules</h2>
              <SampleChip />
            </div>
            <div className="border border-line">
              {DEMO_APPROVAL_RULES.map((r) => (
                <div
                  key={r.rule}
                  className="grid gap-4 md:grid-cols-[minmax(0,1fr)_290px] px-4 py-3.5 border-b border-line last:border-b-0 items-center"
                >
                  <div className="text-[13px]">{r.rule}</div>
                  <div className="text-[12.5px] text-ink-60">{r.owner}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Live admin links */}
        <aside>
          <MicroLabel className="mb-4">Workspace configuration</MicroLabel>
          {isAdmin ? (
            <div className="grid gap-px bg-line border border-line">
              <div className="bg-panel px-5 py-5">
                <div className="text-[14px] font-semibold">Commercial rules</div>
                <p className="text-[12.5px] leading-[1.6] text-ink-60 mt-2">
                  Default cost items and contingency used when a tender carries no cost breakdown of
                  its own.
                </p>
                <div className="mt-4">
                  <Btn href="/admin" variant="outline" className="!py-2 !px-3.5">
                    Open
                  </Btn>
                </div>
              </div>
              <div className="bg-panel px-5 py-5">
                <div className="text-[14px] font-semibold">Model management</div>
                <p className="text-[12.5px] leading-[1.6] text-ink-60 mt-2">
                  Choose the provider and model backing each analysis agent.
                </p>
                <div className="mt-4">
                  <Btn href="/admin/models" variant="outline" className="!py-2 !px-3.5">
                    Open
                  </Btn>
                </div>
              </div>
              <div className="bg-panel px-5 py-5">
                <div className="text-[14px] font-semibold">Company context</div>
                <p className="text-[12.5px] leading-[1.6] text-ink-60 mt-2">
                  Documents that shape how every tender is assessed.
                </p>
                <div className="mt-4">
                  <Btn href="/admin/company-context" variant="outline" className="!py-2 !px-3.5">
                    Open
                  </Btn>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-line bg-panel px-5 py-5">
              <p className="text-[13px] leading-[1.6] text-ink-72">
                Workspace configuration is available to admin accounts. You are signed in as{' '}
                <span className="font-medium">{user?.name}</span> ({user?.role}).
              </p>
            </div>
          )}

          <div className="mt-10 border-t border-line pt-6">
            <MicroLabel className="mb-3">Data &amp; security</MicroLabel>
            <ul className="space-y-2.5 text-[12.5px] leading-[1.55] text-ink-72">
              <li>Documents are never used to train models</li>
              <li>Workspace data is isolated per tenant</li>
              <li>Analyses retained until deleted by an admin</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
