'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { Btn, MicroLabel, SampleChip } from '@/components/ui';
import { DEMO_SOURCE_DOCS, DEMO_WORKSPACE } from '@/lib/demo-data';

interface BidRow {
  id: string;
  file_name: string;
  doc_type: string;
  created_at: string;
}

export default function SourcesPage() {
  const [bids, setBids] = useState<BidRow[]>([]);

  useEffect(() => {
    fetch('/api/bids?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBids(d.bids || []))
      .catch(() => {});
  }, []);

  return (
    <AppShell
      title="Sources"
      subtitle="Every document behind the workspace"
      actions={<Btn href="/" variant="accent">Upload a document</Btn>}
    >
      <div className="font-mono text-[12px] text-ink-60 -mt-4 mb-8">
        {DEMO_WORKSPACE.sourceCount} indexed documents · {DEMO_WORKSPACE.factCount} extracted facts
      </div>

      {/* Real uploads */}
      <section>
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 mb-1">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Analyzed in this workspace</h2>
          <span className="font-mono text-[12px] text-ink-60">{bids.length}</span>
        </div>
        {bids.length === 0 ? (
          <p className="text-[13px] text-ink-60 py-6">
            No documents analyzed yet — uploads appear here once processed.
          </p>
        ) : (
          <div className="border border-line mt-4">
            <div className="grid grid-cols-[minmax(0,1fr)_150px_170px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
              <div className="micro">Document</div>
              <div className="micro">Type</div>
              <div className="micro">Analyzed</div>
            </div>
            {bids.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-[minmax(0,1fr)_150px_170px] gap-4 px-4 py-3.5 border-b border-line last:border-b-0 items-center"
              >
                <div className="font-mono text-[12.5px] truncate">{b.file_name}</div>
                <div className="text-[12px] text-accent">{b.doc_type}</div>
                <div className="font-mono text-[11.5px] text-ink-45">
                  {b.created_at ? new Date(b.created_at).toLocaleString() : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sample corpus */}
      <section className="mt-14">
        <div className="flex items-center gap-3 border-b border-line pb-3 mb-4">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Indexed corpus</h2>
          <SampleChip />
        </div>
        <div className="border border-line">
          <div className="grid grid-cols-[minmax(0,1fr)_160px_110px_90px_140px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
            <div className="micro">Document</div>
            <div className="micro">Origin</div>
            <div className="micro">Size</div>
            <div className="micro">Facts</div>
            <div className="micro">Indexed</div>
          </div>
          {DEMO_SOURCE_DOCS.map((d) => (
            <div
              key={d.name}
              className="grid grid-cols-[minmax(0,1fr)_160px_110px_90px_140px] gap-4 px-4 py-3.5 border-b border-line last:border-b-0 items-center"
            >
              <div className="font-mono text-[12.5px] truncate">{d.name}</div>
              <div className={`text-[12px] ${d.origin === 'Tender' ? 'text-accent' : 'text-ink-60'}`}>
                {d.origin}
              </div>
              <div className="font-mono text-[12px] text-ink-60">{d.size}</div>
              <div className="font-mono text-[12px]">{d.facts}</div>
              <div className="font-mono text-[11.5px] text-ink-45">{d.indexed}</div>
            </div>
          ))}
        </div>
        <MicroLabel className="mt-4">
          Clause-level provenance shown throughout the workspace is drawn from this corpus
        </MicroLabel>
      </section>
    </AppShell>
  );
}
