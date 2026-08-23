'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {
  Btn,
  DecisionChip,
  MicroLabel,
  RuledNote,
  SampleChip,
  StatTile,
  StatTileGrid,
  riskTextClass,
} from '@/components/ui';
import {
  DEMO_CLAUSES,
  DEMO_COMMENTS,
  DEMO_COST_BASE,
  DEMO_REQUIREMENTS,
  DEMO_SOURCE_DOCS,
  DEMO_TENDER,
  DemoClause,
} from '@/lib/demo-data';

const TABS = [
  'Overview',
  'Requirements',
  'Risk',
  'Commercial',
  'Contract',
  'Response',
  'Decision',
  'Sources',
] as const;
type Tab = (typeof TABS)[number];

interface BidRow {
  id: string;
  file_name: string;
  doc_type: string;
  risk_score: number | null;
  risk_factors?: { bid_decision?: string; risk_level?: string } | null;
  created_at: string;
}

const gbp = (thousands: number) => `£${(thousands / 1000).toFixed(2)}M`;

export default function TendersPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [bids, setBids] = useState<BidRow[]>([]);

  // Scenario levers for the Commercial tab.
  const [labourPct, setLabourPct] = useState(4.2);
  const [materialPct, setMaterialPct] = useState(3.5);
  const [contingency, setContingency] = useState(7.5);

  const [comments, setComments] = useState(DEMO_COMMENTS);
  const [draft, setDraft] = useState('');
  const [clause, setClause] = useState<DemoClause>(DEMO_CLAUSES[0]);

  useEffect(() => {
    fetch('/api/bids?limit=10')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBids(d.bids || []))
      .catch(() => {});
  }, []);

  const model = useMemo(() => {
    const labour = DEMO_COST_BASE.labour * (1 + labourPct / 100);
    const material = DEMO_COST_BASE.material * (1 + materialPct / 100);
    const base = labour + material + DEMO_COST_BASE.plant + DEMO_COST_BASE.subcontract +
      DEMO_COST_BASE.overhead;
    const cont = base * (contingency / 100);
    const total = base + cont;
    const price = 42000;
    const margin = ((price - total) / price) * 100;
    return { labour, material, base, cont, total, price, margin };
  }, [labourPct, materialPct, contingency]);

  const post = () => {
    if (!draft.trim()) return;
    setComments((c) => [
      ...c,
      { initials: 'SM', name: 'Sarah Mitchell', role: 'Commercial Director', time: 'now', body: draft },
    ]);
    setDraft('');
  };

  return (
    <AppShell
      title={DEMO_TENDER.title}
      subtitle={`${DEMO_TENDER.client} · ${DEMO_TENDER.reference}`}
      actions={<Btn href="/" variant="accent">Analyze new tender</Btn>}
    >
      <div className="flex items-center gap-3 font-mono text-[12px] text-ink-60 -mt-4 mb-7 flex-wrap">
        <span>Deadline {DEMO_TENDER.deadline}</span>
        <span className="text-line-strong">·</span>
        <span>{DEMO_TENDER.value} / {DEMO_TENDER.term}</span>
        <span className="text-line-strong">·</span>
        <span className="text-danger">{DEMO_TENDER.riskDetail}</span>
        <SampleChip label="sample tender" />
      </div>

      {/* Tabs */}
      <div className="border-b border-line flex gap-7 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-accent text-ink font-semibold'
                : 'border-transparent text-ink-60 hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-8">
        {tab === 'Overview' && (
          <>
            <StatTileGrid cols={3}>
              <StatTile
                label="Opportunity value"
                value={DEMO_TENDER.value}
                caption={`Estimated contract value · ${DEMO_TENDER.term}`}
              />
              <StatTile
                label="Expected gross margin"
                value={DEMO_TENDER.margin}
                caption={`Company threshold: ${DEMO_TENDER.marginThreshold} · live model`}
              />
              <StatTile
                label="Risk exposure"
                value={DEMO_TENDER.risk}
                caption={DEMO_TENDER.riskDetail}
                tone="danger"
                mono={false}
              />
            </StatTileGrid>

            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] mt-10">
              <div>
                <h2 className="text-[19px] font-semibold tracking-[-0.02em] mb-4">
                  TenderMind assessment
                </h2>
                <RuledNote tone="danger">{DEMO_TENDER.assessment}</RuledNote>

                <MicroLabel className="mt-9 mb-3">Requirement coverage</MicroLabel>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[6px] bg-line flex">
                    <div style={{ width: '67%', background: '#4A6B3F' }} />
                    <div style={{ width: '22%', background: '#B98A2E' }} />
                    <div style={{ width: '11%', background: '#C4512D' }} />
                  </div>
                  <span className="font-mono text-[12px] text-ink-60">
                    {DEMO_REQUIREMENTS.filter((r) => r.status === 'Meets').length}/
                    {DEMO_REQUIREMENTS.length} met
                  </span>
                </div>
              </div>

              <div className="border-l-2 border-accent pl-4 self-start">
                <MicroLabel>Recommendation</MicroLabel>
                <div className="text-[17px] font-semibold mt-2">{DEMO_TENDER.recommendation}</div>
                <div className="text-[12px] text-ink-60 mt-1.5">
                  Confidence {DEMO_TENDER.confidence} · {DEMO_TENDER.conditions} conditions
                </div>
                <button
                  onClick={() => setTab('Decision')}
                  className="micro mt-4 hover:text-accent"
                >
                  See how this was reached →
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'Requirements' && (
          <div className="border border-line">
            <div className="grid grid-cols-[90px_minmax(0,1fr)_110px_minmax(0,1fr)] gap-4 px-4 py-2.5 border-b border-line bg-panel">
              <div className="micro">Ref</div>
              <div className="micro">Requirement</div>
              <div className="micro">Status</div>
              <div className="micro">Evidence</div>
            </div>
            {DEMO_REQUIREMENTS.map((r) => (
              <div
                key={r.ref}
                className="grid grid-cols-[90px_minmax(0,1fr)_110px_minmax(0,1fr)] gap-4 px-4 py-4 border-b border-line last:border-b-0 items-start"
              >
                <div className="font-mono text-[12px] text-ink-60">{r.ref}</div>
                <div className="text-[13px] leading-[1.5]">{r.requirement}</div>
                <div
                  className={`text-[12.5px] font-medium ${
                    r.status === 'Meets'
                      ? 'text-ok'
                      : r.status === 'Attention'
                        ? 'text-warn'
                        : 'text-danger'
                  }`}
                >
                  {r.status}
                </div>
                <div className="text-[12px] text-ink-60 leading-[1.5]">{r.evidence}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Risk' && (
          <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="border border-line self-start">
              {DEMO_CLAUSES.map((c) => (
                <button
                  key={c.ref}
                  onClick={() => setClause(c)}
                  className={`w-full text-left px-4 py-3.5 border-b border-line last:border-b-0 transition-colors ${
                    clause.ref === c.ref ? 'bg-panel2' : 'hover:bg-ink-08'
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

            <div>
              <MicroLabel className="mb-2">Clause {clause.ref}</MicroLabel>
              <h3 className="text-[21px] font-semibold tracking-[-0.02em]">{clause.title}</h3>
              <p className="text-[13.5px] leading-[1.7] text-ink-72 mt-4 italic border-l-2 border-line-strong pl-4">
                “{clause.text}”
              </p>
              <MicroLabel className="mt-8 mb-3">Suggested position</MicroLabel>
              <RuledNote tone="accent">{clause.position}</RuledNote>
            </div>
          </div>
        )}

        {tab === 'Commercial' && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_330px]">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.02em] mb-5">True cost model</h2>
              <div className="border border-line">
                {[
                  ['Labour', model.labour],
                  ['Materials', model.material],
                  ['Plant', DEMO_COST_BASE.plant],
                  ['Subcontract', DEMO_COST_BASE.subcontract],
                  ['Overhead', DEMO_COST_BASE.overhead],
                ].map(([label, val]) => (
                  <div
                    key={label as string}
                    className="flex items-center justify-between px-4 py-3 border-b border-line"
                  >
                    <span className="text-[13px]">{label as string}</span>
                    <span className="font-mono text-[13px]">{gbp(val as number)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                  <span className="text-[13px] text-ink-60">
                    Contingency @ {contingency.toFixed(1)}%
                  </span>
                  <span className="font-mono text-[13px] text-ink-60">{gbp(model.cont)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5 bg-panel">
                  <span className="text-[13px] font-semibold">Total cost</span>
                  <span className="font-mono text-[15px] font-semibold">{gbp(model.total)}</span>
                </div>
              </div>

              <MicroLabel className="mt-9 mb-4">Scenario levers</MicroLabel>
              <div className="space-y-6">
                {[
                  ['Labour inflation', labourPct, setLabourPct, 0, 12],
                  ['Material inflation', materialPct, setMaterialPct, 0, 12],
                  ['Contingency', contingency, setContingency, 0, 15],
                ].map(([label, val, setter, min, max]) => (
                  <div key={label as string}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-[12.5px]">{label as string}</span>
                      <span className="font-mono text-[12.5px] text-accent">
                        {(val as number).toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      className="tm-range"
                      min={min as number}
                      max={max as number}
                      step={0.1}
                      value={val as number}
                      onChange={(e) =>
                        (setter as (n: number) => void)(parseFloat(e.target.value))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <aside className="bg-panel2 px-6 py-6 self-start">
              <MicroLabel>Target commercial bid</MicroLabel>
              <div className="font-mono text-[34px] leading-none mt-3">
                {gbp(model.price)}
              </div>
              <div className="mt-5 space-y-2.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-ink-60">Modeled cost</span>
                  <span className="font-mono">{gbp(model.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-60">Gross margin</span>
                  <span
                    className={`font-mono ${model.margin < 18 ? 'text-danger' : 'text-ok'}`}
                  >
                    {model.margin.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-60">Profit</span>
                  <span className="font-mono">{gbp(model.price - model.total)}</span>
                </div>
              </div>
              <p className="text-[12px] leading-[1.6] text-ink-72 mt-5 pt-5 border-t border-line">
                {model.margin < 18
                  ? 'Below the 18% company floor — this requires Commercial Director and Finance approval.'
                  : 'Within the 18% company margin floor. No additional approval required.'}
              </p>
            </aside>
          </div>
        )}

        {tab === 'Contract' && (
          <div className="border border-line">
            <div className="grid grid-cols-[90px_minmax(0,1fr)_110px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
              <div className="micro">Clause</div>
              <div className="micro">Provision</div>
              <div className="micro">Severity</div>
            </div>
            {DEMO_CLAUSES.map((c) => (
              <div key={c.ref} className="border-b border-line last:border-b-0 px-4 py-4">
                <div className="grid grid-cols-[90px_minmax(0,1fr)_110px] gap-4 items-start">
                  <div className="font-mono text-[12px] text-ink-60">{c.ref}</div>
                  <div>
                    <div className="text-[13.5px] font-medium">{c.title}</div>
                    <p className="text-[12.5px] leading-[1.6] text-ink-60 mt-1.5 italic">
                      “{c.text}”
                    </p>
                  </div>
                  <div className={`text-[12.5px] font-medium ${riskTextClass(c.severity)}`}>
                    {c.severity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Response' && (
          <div className="grid gap-8 md:grid-cols-2">
            {[
              ['Method statement', '18 of 22 answers drafted', 82],
              ['Social value', '4 of 9 answers drafted', 44],
              ['Health & safety', '11 of 11 answers drafted', 100],
              ['Commercial schedule', '6 of 14 tabs completed', 43],
            ].map(([title, detail, pct]) => (
              <div key={title as string} className="border border-line px-5 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[14px] font-semibold">{title as string}</div>
                  <span className="font-mono text-[12px] text-ink-60">{pct as number}%</span>
                </div>
                <div className="h-[3px] bg-line mt-3">
                  <div
                    className="h-full"
                    style={{
                      width: `${pct as number}%`,
                      background: (pct as number) === 100 ? '#4A6B3F' : '#C4512D',
                    }}
                  />
                </div>
                <div className="text-[12.5px] text-ink-60 mt-3">{detail as string}</div>
              </div>
            ))}
            <div className="md:col-span-2">
              <SampleChip label="sample response pack" />
            </div>
          </div>
        )}

        {tab === 'Decision' && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="border-t-2 border-ink pt-5">
                <MicroLabel>TenderMind recommendation</MicroLabel>
                <div className="text-[34px] font-semibold tracking-[-0.03em] mt-3">
                  {DEMO_TENDER.recommendation}
                </div>
                <div className="font-mono text-[12.5px] text-ink-60 mt-2">
                  Confidence {DEMO_TENDER.confidence} · {DEMO_TENDER.conditions} conditions attached
                </div>
              </div>

              <div className="grid gap-px bg-line border border-line mt-8 sm:grid-cols-4">
                {[
                  ['Legal', 'Red', 'text-danger'],
                  ['Engineering', 'Green', 'text-ok'],
                  ['Commercial', 'Amber', 'text-warn'],
                  ['Risk', 'High', 'text-danger'],
                ].map(([k, v, cls]) => (
                  <div key={k as string} className="bg-panel px-4 py-3.5">
                    <div className="text-[11px] text-ink-60">{k as string}</div>
                    <div className={`text-[15px] font-semibold mt-1.5 ${cls as string}`}>
                      {v as string}
                    </div>
                  </div>
                ))}
              </div>

              <MicroLabel className="mt-9 mb-3">Conditions</MicroLabel>
              <ul className="space-y-3">
                {DEMO_CLAUSES.slice(0, 3).map((c) => (
                  <li key={c.ref} className="flex gap-3 text-[13px] leading-[1.55] text-ink-72">
                    <span className="font-mono text-[11.5px] text-accent mt-0.5">
                      {c.ref}
                    </span>
                    <span>{c.position}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Comments */}
            <aside>
              <MicroLabel className="mb-4">Discussion</MicroLabel>
              <div className="space-y-5">
                {comments.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <div
                      className={`h-8 w-8 shrink-0 flex items-center justify-center font-mono text-[11px] ${
                        c.isModel ? 'bg-ink text-cream' : 'bg-panel2 text-ink'
                      }`}
                    >
                      {c.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[12.5px] font-semibold">{c.name}</span>
                        <span className="text-[11px] text-ink-45">{c.role}</span>
                        <span className="font-mono text-[10.5px] text-ink-45">{c.time}</span>
                      </div>
                      <p className="text-[12.5px] leading-[1.6] text-ink-72 mt-1.5">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-line">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment…"
                  rows={3}
                  className="w-full bg-panel border border-line px-3 py-2.5 text-[13px] outline-none focus:border-line-strong resize-none"
                />
                <div className="mt-2.5">
                  <Btn onClick={post} variant="ink" className="!py-2 !px-3.5">
                    Post comment
                  </Btn>
                </div>
              </div>
            </aside>
          </div>
        )}

        {tab === 'Sources' && (
          <div className="border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_150px_110px_90px_130px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
              <div className="micro">Document</div>
              <div className="micro">Origin</div>
              <div className="micro">Size</div>
              <div className="micro">Facts</div>
              <div className="micro">Indexed</div>
            </div>
            {DEMO_SOURCE_DOCS.map((d) => (
              <div
                key={d.name}
                className="grid grid-cols-[minmax(0,1fr)_150px_110px_90px_130px] gap-4 px-4 py-3.5 border-b border-line last:border-b-0 items-center"
              >
                <div className="font-mono text-[12.5px] truncate">{d.name}</div>
                <div
                  className={`text-[12px] ${d.origin === 'Tender' ? 'text-accent' : 'text-ink-60'}`}
                >
                  {d.origin}
                </div>
                <div className="font-mono text-[12px] text-ink-60">{d.size}</div>
                <div className="font-mono text-[12px]">{d.facts}</div>
                <div className="font-mono text-[11.5px] text-ink-45">{d.indexed}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real analyses */}
      <section className="mt-16 border-t border-line pt-8">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Your analyzed tenders</h2>
          <span className="font-mono text-[12px] text-ink-60">{bids.length} live</span>
        </div>
        {bids.length === 0 ? (
          <div className="border border-line bg-panel px-6 py-8">
            <p className="text-[13px] text-ink-72">
              Nothing analyzed yet. Upload a tender from the dashboard and it will appear here with
              its full assessment.
            </p>
            <div className="mt-4">
              <Btn href="/" variant="accent">Analyze a tender</Btn>
            </div>
          </div>
        ) : (
          <div className="border border-line">
            {bids.map((b) => (
              <Link
                key={b.id}
                href={`/bid/${b.id}`}
                className="grid grid-cols-[minmax(0,1fr)_140px_110px_100px] gap-4 px-4 py-3.5 border-b border-line last:border-b-0 items-center hover:bg-ink-08 transition-colors"
              >
                <div className="text-[13.5px] font-medium truncate">{b.file_name}</div>
                <div className="text-[12px] text-ink-60">{b.doc_type}</div>
                <div className={`text-[12.5px] ${riskTextClass(b.risk_factors?.risk_level)}`}>
                  {b.risk_factors?.risk_level || '—'}
                </div>
                <DecisionChip decision={b.risk_factors?.bid_decision} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
