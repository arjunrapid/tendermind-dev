'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BoqItem {
  key: string;
  name: string;
  item_type: 'measured' | 'lump_sum';
  quantity: number | null;
  unit: string | null;
  unit_rate: number | null;
  lump_sum_amount: number | null;
}

interface BoqItemWithAmount extends BoqItem {
  amount: number;
}

interface BoqSummary {
  items: BoqItemWithAmount[];
  measured_cost: number;
  lump_sum_cost: number;
  contingency_percentage: number;
  contingency_amount: number;
  total_estimated_cost: number;
}

function computeSummary(items: BoqItem[], contingencyPercentage: number): BoqSummary {
  const withAmounts: BoqItemWithAmount[] = items.map((item) => ({
    ...item,
    amount:
      item.item_type === 'lump_sum'
        ? item.lump_sum_amount || 0
        : (item.quantity || 0) * (item.unit_rate || 0),
  }));

  const measured_cost = withAmounts
    .filter((item) => item.item_type === 'measured')
    .reduce((sum, item) => sum + item.amount, 0);
  const lump_sum_cost = withAmounts
    .filter((item) => item.item_type === 'lump_sum')
    .reduce((sum, item) => sum + item.amount, 0);
  const base_cost = measured_cost + lump_sum_cost;
  const contingency_amount = base_cost * contingencyPercentage;

  return {
    items: withAmounts,
    measured_cost,
    lump_sum_cost,
    contingency_percentage: contingencyPercentage,
    contingency_amount,
    total_estimated_cost: base_cost + contingency_amount,
  };
}

const CONTINGENCY_PERCENTAGE = 0.1;

export default function AdminBoqPage() {
  const [items, setItems] = useState<BoqItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const response = await fetch('/api/admin/boq');
        if (!response.ok) throw new Error('Failed to load BOQ defaults');
        const data = await response.json();
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDefaults();
  }, []);

  const updateItem = (key: string, field: keyof BoqItem, value: string) => {
    setItems((prev) =>
      prev
        ? prev.map((item) =>
            item.key === key
              ? {
                  ...item,
                  [field]: field === 'unit' ? value : value === '' ? null : Number(value),
                }
              : item,
          )
        : prev,
    );
  };

  const handleSave = async () => {
    if (!items) return;
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch('/api/admin/boq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) throw new Error('Failed to save BOQ defaults');
      setSavedMessage('Default values saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const summary = items ? computeSummary(items, CONTINGENCY_PERCENTAGE) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Admin — Default Cost Items
              </h1>
              <p className="text-gray-600 mt-1">
                Set default BOQ quantities and rates used for accounting calculations.
              </p>
            </div>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4" />
              <p className="text-gray-600 font-medium">Loading defaults...</p>
            </div>
          </div>
        ) : items ? (
          <>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Rate / Lump Sum
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key} className="border-b border-gray-200">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">$</span>
                            <input
                              type="number"
                              value={
                                item.item_type === 'lump_sum'
                                  ? item.lump_sum_amount ?? ''
                                  : item.unit_rate ?? ''
                              }
                              onChange={(e) =>
                                updateItem(
                                  item.key,
                                  item.item_type === 'lump_sum'
                                    ? 'lump_sum_amount'
                                    : 'unit_rate',
                                  e.target.value,
                                )
                              }
                              className="w-28 px-2 py-1 border border-gray-300 rounded"
                            />
                            {item.item_type === 'measured' && item.unit && (
                              <span className="text-gray-500 text-xs">
                                /{item.unit}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-gray-200 flex items-center justify-between">
                <div>
                  {error && <p className="text-red-600 text-sm">{error}</p>}
                  {savedMessage && (
                    <p className="text-green-600 text-sm">{savedMessage}</p>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Defaults'}
                </button>
              </div>
            </div>

            {summary && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Calculated Accounting Estimate
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Measured Items</p>
                    <p className="font-semibold text-lg">
                      ${summary.measured_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Lump Sum Items</p>
                    <p className="font-semibold text-lg">
                      ${summary.lump_sum_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Contingency ({(summary.contingency_percentage * 100).toFixed(0)}%)
                    </p>
                    <p className="font-semibold text-lg">
                      ${summary.contingency_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Estimated Cost</p>
                    <p className="font-semibold text-lg">
                      ${summary.total_estimated_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-4">
                  This estimate is used as the accounting baseline for new document analyses
                  whenever the document itself doesn&apos;t specify enough cost detail.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
