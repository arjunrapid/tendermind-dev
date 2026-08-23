interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  accent?: 'blue' | 'green' | 'amber' | 'gray';
}

/** Accent names are kept from the previous dashboard kit so callers don't
 * change; each maps onto a colour from the cream/ink palette. */
const ACCENT_CLASSES: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'text-ink',
  green: 'text-ok',
  amber: 'text-warn',
  gray: 'text-ink-45',
};

/** Metric tile: muted label above a large mono figure. Meant to sit in a
 * 1px-gap grid so the surrounding background reads as hairline rules. */
export default function StatCard({ label, value, accent = 'blue' }: StatCardProps) {
  return (
    <div className="bg-panel px-5 py-4">
      <p className="text-[11px] text-ink-60 truncate">{label}</p>
      <p className={`mt-2 font-mono text-[26px] leading-tight ${ACCENT_CLASSES[accent]}`}>{value}</p>
    </div>
  );
}
