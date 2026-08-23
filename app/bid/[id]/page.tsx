'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ResultsView from '@/components/ResultsView';
import AppShell from '@/components/AppShell';

interface BidDetail {
  id: string;
  file_name: string;
  doc_type: string;
  extracted_text: string;
  classification_confidence: number;
  legal_assessment: Record<string, unknown>;
  engineering_assessment: Record<string, unknown>;
  accounting_assessment: Record<string, unknown>;
  risk_score: number;
  risk_factors: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  created_at: string;
}

export default function BidDetailPage() {
  const params = useParams();
  const bidId = params?.id as string;
  const [bid, setBid] = useState<BidDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBid = async () => {
      try {
        const response = await fetch(`/api/bid/${bidId}`);
        if (!response.ok) throw new Error('Bid not found');
        const data = await response.json();
        setBid(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (bidId) {
      fetchBid();
    }
  }, [bidId]);

  if (isLoading) {
    return (
      <AppShell title="Bid Details">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">Loading bid details...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !bid) {
    return (
      <AppShell title="Bid Details">
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 rounded-lg">
          <p className="text-red-700 dark:text-red-400 font-semibold">Error</p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error || 'Bid not found'}</p>
          <div className="flex gap-4 mt-4">
            <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
              ← Back to Home
            </Link>
            <Link href="/bids" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
              ← Back to Bid History
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppShell
      title="Bid Details"
      subtitle={bid.file_name}
      actions={
        <Link href="/bids" className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
          ← Back to Bid History
        </Link>
      }
    >
      <div>
        {/* Metadata */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Document Type</p>
              <p className="font-semibold text-lg">{bid.doc_type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Confidence</p>
              <p className="font-semibold text-lg">
                {(bid.classification_confidence * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Risk Score</p>
              <p className="font-semibold text-lg">
                {(bid.risk_score * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Uploaded</p>
              <p className="font-semibold text-sm">{formatDate(bid.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Main Results View */}
        <ResultsView
          result={{
            id: bid.id,
            fileName: bid.file_name,
            classification: {
              doc_type: bid.doc_type,
              confidence: bid.classification_confidence,
            },
            legalAssessment: bid.legal_assessment,
            engineeringAssessment: bid.engineering_assessment,
            accountingAssessment: bid.accounting_assessment,
            riskAssessment: {
              risk_score: bid.risk_score,
              ...bid.risk_factors,
            },
            bidRecommendation: bid.recommendation,
          }}
        />

        {/* Extracted Text Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Extracted Text Preview
          </h2>
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {bid.extracted_text.substring(0, 2000)}
              {bid.extracted_text.length > 2000 && '...'}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
