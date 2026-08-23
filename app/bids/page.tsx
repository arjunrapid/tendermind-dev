'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    if (score < 0.4) return 'text-green-600 bg-green-50';
    if (score < 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Bid History
              </h1>
              <p className="text-gray-600 mt-1">
                Review previous document analyses and bid recommendations
              </p>
            </div>
            <nav>
              <Link
                href="/"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                New Analysis
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4" />
              <p className="text-gray-600 font-medium">Loading bid history...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-700 font-semibold">Error</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        ) : bids.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No bids found yet</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Your First Document
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Document Type
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Risk Level
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Recommend to Bid?
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Bid Recommendation
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid) => (
                    <tr key={bid.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {bid.file_name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
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
                            return <span className="text-gray-400">N/A</span>;
                          }
                          const isYes = decision === 'YES';
                          return (
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                isYes
                                  ? 'text-green-700 bg-green-100'
                                  : 'text-red-700 bg-red-100'
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
                              <span className="text-gray-400 font-normal">
                                Not recommended
                              </span>
                            );
                          }

                          return price != null
                            ? `$${(price as number).toLocaleString()}`
                            : 'N/A';
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(bid.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-4">
                          <Link
                            href={`/bid/${bid.id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => handleDelete(bid)}
                            disabled={deletingId === bid.id}
                            className="text-red-600 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
    </main>
  );
}
