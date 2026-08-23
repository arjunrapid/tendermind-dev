interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  accent?: 'blue' | 'green' | 'amber' | 'gray';
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
  green: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400',
  amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

/** Small dashboard-style metric tile (icon + label + big number), the kind
 * of stat row a dashboard kit puts at the top of its main view - used to
 * give at-a-glance context before the upload form / table below it. */
export default function StatCard({ label, value, icon, accent = 'blue' }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-lg flex items-center justify-center text-xl shrink-0 ${ACCENT_CLASSES[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}
