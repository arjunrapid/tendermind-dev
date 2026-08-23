'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Btn, MarketingShell, MicroLabel } from '@/components/ui';

const STAT_RAIL = [
  { value: '1,240', label: 'Tenders analyzed' },
  { value: '£3.1bn', label: 'Contract value assessed' },
  { value: '31%', label: 'Average reduction in pre-bid review time' },
];

const CAPABILITIES = [
  {
    label: 'Legal',
    title: 'Every clause read, not skimmed',
    body: 'Liability caps, payment windows, service credits and termination rights are extracted with the clause reference attached, so a finding can always be traced back to the page it came from.',
  },
  {
    label: 'Engineering',
    title: 'Buildability against your record',
    body: 'Programme, site constraints and technical scope are assessed for feasibility rather than summarised, flagging where the schedule assumes conditions the documents never confirm.',
  },
  {
    label: 'Commercial',
    title: 'A cost model, not a guess',
    body: 'Bill of quantities, contingency and lock-up are modelled into a target price with an explicit margin, so the number carries its own reasoning.',
  },
  {
    label: 'Risk',
    title: 'One decision, fully evidenced',
    body: 'Findings aggregate into a bid / no-bid recommendation with a confidence score and the specific factors behind it — including when the analysis is too incomplete to be trusted.',
  },
];

export default function WelcomePage() {
  const { user } = useAuth();

  return (
    <MarketingShell
      ctaHref={user ? '/' : '/login'}
      ctaLabel={user ? 'Open workspace' : 'Sign in'}
    >
      {/* Hero */}
      <section className="max-w-[1180px] mx-auto px-8 pt-24 pb-20">
        <MicroLabel className="!text-accent mb-6">Tender intelligence</MicroLabel>
        <h1 className="text-[54px] leading-[1.04] font-semibold tracking-[-0.035em] max-w-[16ch]">
          Know the real risk before you bid.
        </h1>
        <p className="mt-7 text-[16px] leading-[1.7] text-ink-72 max-w-[54ch]">
          TenderMind reads a construction tender the way your best commercial lead would — legal
          exposure, buildability, true cost and the decision that follows from them — and shows its
          working for every conclusion.
        </p>
        <div className="mt-9 flex items-center gap-3 flex-wrap">
          <Btn href={user ? '/' : '/login'} variant="accent">
            {user ? 'Open workspace' : 'Analyze a tender'}
          </Btn>
          <Btn href="/pricing" variant="outline">
            See pricing
          </Btn>
        </div>

        {/* Stat rail */}
        <div className="mt-20 grid gap-px bg-line border border-line sm:grid-cols-3">
          {STAT_RAIL.map((s) => (
            <div key={s.label} className="bg-cream px-6 py-7">
              <div className="font-mono text-[30px] leading-none">{s.value}</div>
              <div className="mt-3 text-[12px] text-ink-60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Framed product preview */}
      <section className="max-w-[1180px] mx-auto px-8 pb-24">
        <div className="border border-line bg-panel">
          <div className="border-b border-line px-4 h-10 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong inline-block" />
            <span className="ml-3 font-mono text-[11px] text-ink-45">
              tendermind — Southern Region Maintenance Framework
            </span>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '190px minmax(0,1fr)' }}>
            <div className="border-r border-line px-4 py-5 flex flex-col gap-2.5 text-[12.5px] text-ink-60">
              <MicroLabel className="mb-1">Workspace</MicroLabel>
              <div>Overview</div>
              <div>Company Memory</div>
              <div className="text-ink font-semibold">Tenders</div>
              <div>Bid Pipeline</div>
              <div>Commercial</div>
              <div>Legal</div>
              <div>Sources</div>
            </div>

            <div className="px-7 py-6">
              <div className="text-[11.5px] text-ink-45">Network Rail · NR/SRM/2026/042</div>
              <div className="text-[26px] font-semibold tracking-[-0.025em] mt-1.5">
                Southern Region Maintenance Framework
              </div>

              <div className="grid gap-px bg-line border border-line mt-6 sm:grid-cols-3">
                <div className="bg-panel px-4 py-4">
                  <div className="text-[11px] text-ink-45">Estimated value</div>
                  <div className="font-mono text-[22px] mt-1.5">£42.0M</div>
                </div>
                <div className="bg-panel px-4 py-4">
                  <div className="text-[11px] text-ink-45">Modeled gross margin</div>
                  <div className="font-mono text-[22px] mt-1.5">19.8%</div>
                </div>
                <div className="bg-panel px-4 py-4">
                  <div className="text-[11px] text-ink-45">Risk exposure</div>
                  <div className="text-[22px] font-semibold text-danger mt-1">High</div>
                </div>
              </div>

              <div className="mt-6 border-t border-line pt-4 grid gap-7 md:grid-cols-[minmax(0,1fr)_260px]">
                <p className="text-[13px] leading-[1.65] text-ink-72">
                  Three contractual provisions create material downside exposure: uncapped indirect
                  liability (Clause 17.4), a 10-day payment dispute window, and service credits
                  reaching approximately £1.9M annually.
                </p>
                <div className="border-l-2 border-accent pl-3.5">
                  <MicroLabel>Recommendation</MicroLabel>
                  <div className="text-[15px] font-semibold mt-1.5">Proceed — with conditions</div>
                  <div className="text-[11.5px] text-ink-60 mt-1">Confidence 84% · 5 conditions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inverted manifesto */}
      <section className="bg-ink text-cream py-24">
        <div className="max-w-[1180px] mx-auto px-8">
          <h2 className="text-[38px] leading-[1.15] font-semibold tracking-[-0.03em] max-w-[20ch]">
            Your tender should not be reviewed in isolation.
          </h2>
          <p className="mt-6 text-[15px] leading-[1.75] max-w-[62ch]" style={{ opacity: 0.72 }}>
            Most bid decisions are made from a partial read under time pressure — one person on the
            contract, another on the programme, and a price assembled after both. TenderMind runs
            those reviews together, against the same document, and holds the disagreement between
            them where you can see it.
          </p>
          <div className="mt-12 grid gap-px" style={{ background: 'rgba(243,240,232,.16)' }}>
            <div className="grid sm:grid-cols-2 gap-px" style={{ background: 'rgba(243,240,232,.16)' }}>
              {CAPABILITIES.map((c) => (
                <div key={c.label} className="bg-ink px-7 py-8">
                  <div
                    className="font-mono text-[11px] uppercase tracking-[0.1em]"
                    style={{ color: '#c4512d' }}
                  >
                    {c.label}
                  </div>
                  <div className="text-[19px] font-semibold tracking-[-0.02em] mt-3">{c.title}</div>
                  <p className="text-[13.5px] leading-[1.7] mt-3" style={{ opacity: 0.66 }}>
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-[1180px] mx-auto px-8 py-24 text-center">
        <h2 className="text-[34px] font-semibold tracking-[-0.03em]">
          Put your next tender through it.
        </h2>
        <p className="mt-4 text-[15px] text-ink-72 max-w-[52ch] mx-auto leading-[1.7]">
          Upload a contract, specification or bill of quantities and get a fully evidenced bid
          recommendation in minutes.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Btn href={user ? '/' : '/login'} variant="accent">
            {user ? 'Open workspace' : 'Analyze a tender'}
          </Btn>
          <Link href="/pricing" className="text-[13px] text-ink-60 hover:text-ink underline">
            Compare plans
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
