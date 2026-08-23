'use client';

import { Btn, MarketingShell, MicroLabel } from '@/components/ui';

const PLANS = [
  {
    name: 'Team',
    price: '£499',
    cadence: 'per month',
    blurb: 'For a single bid team putting every opportunity through the same review.',
    cta: 'Start workspace',
    highlight: false,
    features: [
      'Up to 20 tender analyses per month',
      'Legal, engineering, commercial and risk agents',
      'Bid / no-bid recommendation with confidence',
      'Bill of quantities cost model',
      'Bid pipeline and history',
      '5 seats',
    ],
  },
  {
    name: 'Business',
    price: '£1,499',
    cadence: 'per month',
    blurb: 'For contractors bidding across regions, with company memory shaping every review.',
    cta: 'Start Business',
    highlight: true,
    features: [
      'Unlimited tender analyses',
      'Company Memory — your rules, rates and precedent',
      'Clause-level provenance on every finding',
      'Margin scenario modelling',
      'Approval rules and decision sign-off',
      '25 seats',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'annual agreement',
    blurb: 'For groups needing deployment, integration and assurance on their own terms.',
    cta: 'Talk to us',
    highlight: false,
    features: [
      'Everything in Business',
      'SSO and role-based access',
      'Document source integrations',
      'Private deployment options',
      'Model selection and routing control',
      'Unlimited seats',
    ],
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="max-w-[1180px] mx-auto px-8 pt-24 pb-16">
        <MicroLabel className="!text-accent mb-6">Pricing</MicroLabel>
        <h1 className="text-[46px] leading-[1.08] font-semibold tracking-[-0.035em] max-w-[18ch]">
          Priced against the bids you win.
        </h1>
        <p className="mt-6 text-[15px] leading-[1.7] text-ink-72 max-w-[56ch]">
          Every plan runs the full agent pipeline. What changes is volume, how much of your own
          commercial history the model can draw on, and how your team signs off.
        </p>
      </section>

      <section className="max-w-[1180px] mx-auto px-8 pb-20">
        <div className="grid gap-px bg-line border border-line lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`px-7 py-8 flex flex-col ${plan.highlight ? 'bg-panel2' : 'bg-cream'}`}
            >
              <div className="flex items-center gap-2">
                <div className="text-[15px] font-semibold">{plan.name}</div>
                {plan.highlight ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent border border-accent px-1.5 py-0.5">
                    Most chosen
                  </span>
                ) : null}
              </div>

              <div className="mt-5 font-mono text-[34px] leading-none">{plan.price}</div>
              <div className="mt-2 text-[11.5px] text-ink-45">{plan.cadence}</div>

              <p className="mt-5 text-[13px] leading-[1.65] text-ink-72">{plan.blurb}</p>

              <ul className="mt-7 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3 text-[13px] leading-[1.5] text-ink-72">
                    <span className="text-accent font-mono text-[12px] mt-px">→</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Btn
                  href="/login"
                  variant={plan.highlight ? 'accent' : 'outline'}
                  className="w-full"
                >
                  {plan.cta}
                </Btn>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[12px] text-ink-45 max-w-[70ch] leading-[1.6]">
          All plans include unlimited document storage and clause-level provenance. Your tender
          documents are never used to train models, and are not shared between workspaces.
        </p>
      </section>
    </MarketingShell>
  );
}
