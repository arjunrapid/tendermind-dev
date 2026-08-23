'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

interface Bid {
  id: string;
  file_name: string;
  doc_type: string;
  risk_score: number;
  created_at: string;
  recommendation: Record<string, unknown>;
  risk_factors: Record<string, unknown>;
}

export default function BidsPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBids = async () => {
      try {
        const response = await fetch('/api/bids?limit=50');
        if (!response.ok) throw new Error('Failed to fetch bids');
        const data = await response.json();
        setBids(data.bids || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBids();
  }, []);

  const handleDelete = async (bid: Bid) => {
    if (
      !confirm(
        `Remove "${bid.file_name}" from bid history? This also deletes the agent memories learned from this document. This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(bid.id);
    try {
      const response = await fetch(`/api/bid/${bid.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete bid');
      setBids((prev) => prev.filter((b) => b.id !== bid.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bid');
    } finally {
      setDeletingId(null);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 0.4) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40';
    if (score < 0.7) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppShell
      title="Bid History"
      subtitle="Review previous document analyses and bid recommendations"
      actions={
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          New Analysis
        </Link>
      }
    >
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading bid history...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-700 dark:text-red-400 font-semibold">Error</p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
          </div>
        ) : bids.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No bids found yet</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Your First Document
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Document Type
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Risk Level
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Recommend to Bid?
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Bid Recommendation
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid) => (
                    <tr key={bid.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {bid.file_name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full text-xs font-semibold">
                          {bid.doc_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(bid.risk_score)}`}
                        >
                          {(bid.risk_score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {(() => {
                          const decision = String(
                            bid.risk_factors?.bid_decision || '',
                          ).toUpperCase();
                          if (!decision) {
                            return <span className="text-gray-400 dark:text-gray-500">N/A</span>;
                          }
                          const isYes = decision === 'YES';
                          return (
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                isYes
                                  ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40'
                                  : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
                              }`}
                            >
                              {decision}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {(() => {
                          const decision = String(
                            bid.risk_factors?.bid_decision || '',
                          ).toUpperCase();
                          const price = bid.recommendation
                            ?.recommended_bid_price;

                          if (decision !== 'YES') {
                            return (
                              <span className="text-gray-400 dark:text-gray-500 font-normal">
                                Not recommended
                              </span>
                            );
                          }

                          return price != null
                            ? `$${(price as number).toLocaleString()}`
                            : 'N/A';
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(bid.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-4">
                          <Link
                            href={`/bid/${bid.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => handleDelete(bid)}
                            disabled={deletingId === bid.id}
                            className="text-red-600 dark:text-red-400 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === bid.id ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
