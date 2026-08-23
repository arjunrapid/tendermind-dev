'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { Btn, MicroLabel, RuledNote, SampleChip, riskTextClass } from '@/components/ui';
import { DEMO_CLAUSES, DemoClause } from '@/lib/demo-data';

export default function LegalPage() {
  const [open, setOpen] = useState<DemoClause | null>(DEMO_CLAUSES[0]);

  return (
    <AppShell
      title="Legal register"
      subtitle="Clauses requiring a negotiating position"
      actions={<Btn href="/tenders" variant="outline">Open tender</Btn>}
    >
      <div className="flex items-center gap-3 font-mono text-[12px] text-ink-60 -mt-4 mb-8">
        <span>{DEMO_CLAUSES.filter((c) => c.severity === 'High').length} high severity</span>
        <span className="text-line-strong">·</span>
        <span>{DEMO_CLAUSES.length} tracked clauses</span>
        <SampleChip />
      </div>

      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border border-line self-start">
          {DEMO_CLAUSES.map((c) => (
            <button
              key={c.ref}
              onClick={() => setOpen(c)}
              className={`w-full text-left px-4 py-4 border-b border-line last:border-b-0 transition-colors ${
                open?.ref === c.ref ? 'bg-panel2' : 'hover:bg-ink-08'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[11.5px] text-ink-45">Clause {c.ref}</span>
                <span className={`text-[11.5px] font-medium ${riskTextClass(c.severity)}`}>
                  {c.severity}
                </span>
              </div>
              <div className="text-[13px] mt-1.5 leading-[1.45]">{c.title}</div>
            </button>
          ))}
        </div>

        {open ? (
          <div>
            <MicroLabel className="mb-2">Clause {open.ref}</MicroLabel>
            <h2 className="text-[24px] font-semibold tracking-[-0.025em]">{open.title}</h2>

            <MicroLabel className="mt-8 mb-3">As drafted</MicroLabel>
            <p className="text-[13.5px] leading-[1.7] text-ink-72 italic border-l-2 border-line-strong pl-4">
              “{open.text}”
            </p>

            <MicroLabel className="mt-8 mb-3">Northstar position</MicroLabel>
            <RuledNote tone="accent">{open.position}</RuledNote>

            <div className="grid gap-px bg-line border border-line mt-9 sm:grid-cols-3">
              <div className="bg-panel px-4 py-3.5">
                <div className="text-[11px] text-ink-60">Severity</div>
                <div className={`text-[15px] font-semibold mt-1.5 ${riskTextClass(open.severity)}`}>
                  {open.severity}
                </div>
              </div>
              <div className="bg-panel px-4 py-3.5">
                <div className="text-[11px] text-ink-60">Owner</div>
                <div className="text-[13px] mt-1.5">Rachel Coombes</div>
              </div>
              <div className="bg-panel px-4 py-3.5">
                <div className="text-[11px] text-ink-60">Status</div>
                <div className="text-[13px] mt-1.5 text-warn">Awaiting counter-party</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
