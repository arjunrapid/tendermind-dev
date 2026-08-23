'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { Btn, MicroLabel, Modal, SampleChip } from '@/components/ui';
import {
  DEMO_COMMERCIAL_RULES,
  DEMO_MEMORY_COVERAGE,
  DEMO_MEMORY_GAPS,
  DEMO_PROFILE_FACTS,
  DEMO_WORKSPACE,
  DemoFact,
} from '@/lib/demo-data';

export default function CompanyMemoryPage() {
  const [fact, setFact] = useState<DemoFact | null>(null);

  return (
    <AppShell
      title={`What does TenderMind know about ${DEMO_WORKSPACE.company.split(' ')[0]}?`}
      subtitle="Company Memory"
      actions={<Btn href="/admin/company-context" variant="outline">Manage documents</Btn>}
    >
      <div className="font-mono text-[12px] text-ink-60 -mt-4 mb-8">
        {DEMO_WORKSPACE.sourceCount} source documents · {DEMO_WORKSPACE.factCount} verified facts ·
        last indexed {DEMO_WORKSPACE.lastIndexed}
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {/* Company profile */}
          <section>
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 mb-1">
              <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Company profile</h2>
              <span className="text-[11.5px] text-ink-45">Click any fact to inspect its sources</span>
            </div>
            <div>
              {DEMO_PROFILE_FACTS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setFact(f)}
                  className="w-full text-left border-b border-line py-4 hover:bg-ink-08 transition-colors group"
                >
                  <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] items-start px-1">
                    <div className="text-[12.5px] text-ink-60">{f.label}</div>
                    <div>
                      <div className="text-[14px] leading-[1.55]">{f.value}</div>
                      <div className="micro mt-1.5 group-hover:text-accent">{f.sources} →</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Commercial rules */}
          <section className="mt-14">
            <div className="flex items-center gap-3 border-b border-line pb-3 mb-1">
              <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Commercial rules</h2>
              <SampleChip />
            </div>
            <p className="text-[12.5px] text-ink-60 mt-3 mb-4">
              Applied automatically when a tender is scored. Recorded from policy documents rather
              than entered by hand.
            </p>
            <div className="border border-line">
              <div className="grid grid-cols-[minmax(0,1fr)_130px_190px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
                <div className="micro">Rule</div>
                <div className="micro">Value</div>
                <div className="micro">Source</div>
              </div>
              {DEMO_COMMERCIAL_RULES.map(([rule, value, source]) => (
                <div
                  key={rule}
                  className="grid grid-cols-[minmax(0,1fr)_130px_190px] gap-4 px-4 py-3.5 border-b border-line last:border-b-0 items-center"
                >
                  <div className="text-[13px]">{rule}</div>
                  <div className="font-mono text-[13px]">{value}</div>
                  <div className="text-[12px] text-ink-45">{source}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Memory health */}
        <aside>
          <MicroLabel className="mb-4">Memory health</MicroLabel>
          <div className="font-mono text-[46px] leading-none">{DEMO_WORKSPACE.memoryHealth}%</div>
          <p className="text-[12.5px] text-ink-60 mt-3">
            coverage across {DEMO_MEMORY_COVERAGE.length} domains
          </p>

          <div className="mt-7 space-y-4">
            {DEMO_MEMORY_COVERAGE.map((c) => (
              <div key={c.domain}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-[12.5px]">{c.domain}</span>
                  <span className="font-mono text-[12px] text-ink-60">{c.pct}%</span>
                </div>
                <div className="h-[3px] bg-line">
                  <div
                    className="h-full"
                    style={{
                      width: `${c.pct}%`,
                      background: c.pct >= 85 ? '#4A6B3F' : c.pct >= 75 ? '#B98A2E' : '#C4512D',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-line pt-6">
            <MicroLabel className="mb-3">Missing information</MicroLabel>
            <ul className="space-y-3">
              {DEMO_MEMORY_GAPS.map((g) => (
                <li key={g} className="flex gap-2.5 text-[12.5px] leading-[1.55] text-ink-72">
                  <span className="text-accent font-mono mt-px">·</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <SampleChip label="sample data" />
            </div>
          </div>
        </aside>
      </div>

      {/* Source inspector */}
      <Modal
        open={!!fact}
        onClose={() => setFact(null)}
        eyebrow="Fact provenance"
        title={fact?.label}
        width={640}
      >
        {fact ? (
          <>
            <div className="text-[15px] leading-[1.6] border-l-2 border-accent pl-4">
              {fact.value}
            </div>
            <MicroLabel className="mt-8 mb-3">Sources</MicroLabel>
            <div className="border border-line">
              {fact.docs.map((d, i) => (
                <div key={d.name} className={i > 0 ? 'border-t border-line' : ''}>
                  <div className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[12.5px]">{d.name}</span>
                      <span className="font-mono text-[11px] text-ink-45">{d.loc}</span>
                    </div>
                    <p className="text-[12.5px] leading-[1.6] text-ink-72 mt-2 italic">
                      “{d.quote}”
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="micro mt-5">Illustrative provenance · sample workspace</p>
          </>
        ) : null}
      </Modal>
    </AppShell>
  );
}
