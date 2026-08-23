'use client';

import AppShell from '@/components/AppShell';
import { MicroLabel, SampleChip } from '@/components/ui';
import { DEMO_APPROVAL_RULES, DEMO_TEAM, DEMO_WORKSPACE } from '@/lib/demo-data';

export default function TeamPage() {
  return (
    <AppShell title="Team" subtitle="Who reviews, who approves">
      <div className="flex items-center gap-3 font-mono text-[12px] text-ink-60 -mt-4 mb-8">
        <span>{DEMO_WORKSPACE.teamCount} seats</span>
        <span className="text-line-strong">·</span>
        <span>{DEMO_TEAM.length} active this week</span>
        <SampleChip />
      </div>

      <div className="border border-line">
        <div className="grid grid-cols-[minmax(0,1fr)_200px_180px_140px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
          <div className="micro">Member</div>
          <div className="micro">Scope</div>
          <div className="micro">Assigned</div>
          <div className="micro">Last seen</div>
        </div>
        {DEMO_TEAM.map((m) => (
          <div
            key={m.name}
            className="grid grid-cols-[minmax(0,1fr)_200px_180px_140px] gap-4 px-4 py-4 border-b border-line last:border-b-0 items-center"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 bg-panel2 flex items-center justify-center font-mono text-[11.5px]">
                {m.initials}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate">{m.name}</div>
                <div className="text-[11.5px] text-ink-45 truncate">{m.role}</div>
              </div>
            </div>
            <div className="text-[12.5px] text-ink-60">{m.scope}</div>
            <div className="text-[12.5px]">{m.assigned}</div>
            <div className="font-mono text-[11.5px] text-ink-45">{m.seen}</div>
          </div>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] border-b border-line pb-3">
          Approval rules
        </h2>
        <p className="text-[12.5px] text-ink-60 mt-3 mb-4">
          A decision that trips any of these cannot be submitted without the named approver.
        </p>
        <div className="border border-line">
          {DEMO_APPROVAL_RULES.map((r) => (
            <div
              key={r.rule}
              className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] px-4 py-3.5 border-b border-line last:border-b-0 items-center"
            >
              <div className="text-[13px]">{r.rule}</div>
              <div className="text-[12.5px] text-ink-60">{r.owner}</div>
            </div>
          ))}
        </div>
        <MicroLabel className="mt-4">Configured in Settings &amp; integrations</MicroLabel>
      </section>
    </AppShell>
  );
}
