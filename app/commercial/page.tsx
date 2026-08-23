'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { Btn, MicroLabel, SampleChip, StatTile, StatTileGrid } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { DEMO_COMMERCIAL_RULES } from '@/lib/demo-data';

interface BoqItem {
  key: string;
  name: string;
  item_type: string;
  quantity?: number | null;
  unit?: string | null;
  unit_rate?: number | null;
  lump_sum_amount?: number | null;
  amount?: number | null;
}

interface BoqSummary {
  measured_cost: number;
  lump_sum_cost: number;
  contingency_percentage: number;
  contingency_amount: number;
  total_estimated_cost: number;
}

const money = (n?: number | null) =>
  typeof n === 'number' ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';

export default function CommercialPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BoqItem[]>([]);
  const [summary, setSummary] = useState<BoqSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/admin/boq')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setItems(d.items || []);
          setSummary(d.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <AppShell
      title="Commercial"
      subtitle="The cost basis behind every recommendation"
      actions={
        user?.role === 'admin' ? (
          <Btn href="/admin" variant="accent">Edit cost items</Btn>
        ) : undefined
      }
    >
      {/* Live cost model */}
      <section>
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] border-b border-line pb-3 mb-5">
          Default cost model
        </h2>

        {summary ? (
          <StatTileGrid cols={3}>
            <StatTile label="Measured works" value={money(summary.measured_cost)} />
            <StatTile label="Lump sum" value={money(summary.lump_sum_cost)} />
            <StatTile
              label="Total estimated cost"
              value={money(summary.total_estimated_cost)}
              caption={`Includes ${(summary.contingency_percentage * 100).toFixed(1)}% contingency`}
              tone="accent"
            />
          </StatTileGrid>
        ) : (
          <p className="text-[13px] text-ink-60 py-4">
            {loaded ? 'Cost model unavailable.' : 'Loading cost model…'}
          </p>
        )}

        {items.length > 0 && (
          <div className="border border-line mt-8">
            <div className="grid grid-cols-[minmax(0,1fr)_110px_120px_120px_130px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
              <div className="micro">Item</div>
              <div className="micro">Type</div>
              <div className="micro">Quantity</div>
              <div className="micro">Rate</div>
              <div className="micro">Amount</div>
            </div>
            {items.map((it) => (
              <div
                key={it.key}
                className="grid grid-cols-[minmax(0,1fr)_110px_120px_120px_130px] gap-4 px-4 py-3.5 border-b border-line last:border-b-0 items-center"
              >
                <div className="text-[13px]">{it.name}</div>
                <div className="text-[12px] text-ink-60">
                  {it.item_type === 'measured' ? 'Measured' : 'Lump sum'}
                </div>
                <div className="font-mono text-[12.5px]">
                  {it.quantity != null ? `${it.quantity} ${it.unit || ''}`.trim() : '—'}
                </div>
                <div className="font-mono text-[12.5px]">{money(it.unit_rate)}</div>
                <div className="font-mono text-[12.5px]">
                  {money(it.amount ?? it.lump_sum_amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Policy rules */}
      <section className="mt-14">
        <div className="flex items-center gap-3 border-b border-line pb-3 mb-4">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Commercial policy</h2>
          <SampleChip />
        </div>
        <div className="border border-line">
          <div className="grid grid-cols-[minmax(0,1fr)_150px_200px] gap-4 px-4 py-2.5 border-b border-line bg-panel">
            <div className="micro">Rule</div>
            <div className="micro">Value</div>
            <div className="micro">Source</div>
          </div>
          {DEMO_COMMERCIAL_RULES.map(([rule, value, source]) => (
            <div
              key={rule}
              className="grid grid-cols-[minmax(0,1fr)_150px_200px] gap-4 px-4 py-3.5 border-b border-line last:border-b-0 items-center"
            >
              <div className="text-[13px]">{rule}</div>
              <div className="font-mono text-[13px]">{value}</div>
              <div className="text-[12px] text-ink-45">{source}</div>
            </div>
          ))}
        </div>
        <MicroLabel className="mt-4">
          Policy values are applied when scoring a tender against company thresholds
        </MicroLabel>
      </section>
    </AppShell>
  );
}
