'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import UploadForm from '@/components/UploadForm';
import ResultsView from '@/components/ResultsView';
import ProcessProgress, { ProcessStage } from '@/components/ProcessProgress';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';

interface DashboardStats {
  total: number;
  recommendedPercent: number;
  avgRiskPercent: number;
}

interface AnalysisResult {
  id: string;
  fileName: string;
  classification: {
    doc_type: string;
    confidence: number;
  };
  legalAssessment: Record<string, unknown>;
  engineeringAssessment: Record<string, unknown>;
  accountingAssessment: Record<string, unknown>;
  riskAssessment: Record<string, unknown>;
  bidRecommendation: Record<string, unknown>;
}

export default function Home() {
  const [stage, setStage] = useState<ProcessStage | null>(null);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    null,
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const analyzeProgressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const isProcessing = stage === 'uploading' || stage === 'analyzing';

  useEffect(() => {
    return () => {
      if (analyzeProgressTimer.current) clearInterval(analyzeProgressTimer.current);
    };
  }, []);

  const refreshStats = async () => {
    try {
      const response = await fetch('/api/bids?limit=100');
      if (!response.ok) return;
      const data = await response.json();
      const bids: Array<{ risk_score?: number; risk_factors?: { bid_decision?: string } }> =
        data.bids || [];
      if (bids.length === 0) {
        setStats({ total: 0, recommendedPercent: 0, avgRiskPercent: 0 });
        return;
      }
      const yesCount = bids.filter(
        (b) => String(b.risk_factors?.bid_decision || '').toUpperCase() === 'YES',
      ).length;
      const scored = bids.filter((b) => typeof b.risk_score === 'number');
      const avgRisk = scored.length
        ? scored.reduce((sum, b) => sum + (b.risk_score || 0), 0) / scored.length
        : 0;
      setStats({
        total: bids.length,
        recommendedPercent: Math.round((yesCount / bids.length) * 100),
        avgRiskPercent: Math.round(avgRisk * 100),
      });
    } catch {
      // Stats are a nice-to-have dashboard summary, not required for the
      // page to function - a fetch failure just leaves the row hidden.
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleUploadStart = (file: File) => {
    setUploadedFileName(file.name);
    setUploadedFile(file);
    setExtractedText(null);
    setAnalysisResult(null);
    setError(null);
    setStage('uploading');
    setProgress(0);
  };

  const handleUploadSuccess = async (data: {
    fileName: string;
    extractedText: string;
    file: File;
  }) => {
    setUploadedFileName(data.fileName);
    setUploadedFile(data.file);
    setExtractedText(data.extractedText);
    setStage('analyzing');

    // The analyze call has no server-sent progress, so ease the bar toward
    // (not to) 90% while it's in flight - the remaining jump to 100% only
    // happens once the real response lands, so the bar never lies about
    // completion.
    setProgress(5);
    analyzeProgressTimer.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.1));
    }, 400);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: data.fileName,
          extractedText: data.extractedText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze document');
      }

      const result = await response.json();
      if (analyzeProgressTimer.current) clearInterval(analyzeProgressTimer.current);
      setProgress(100);
      setAnalysisResult(result);
      setStage('done');
      refreshStats();
    } catch (err) {
      if (analyzeProgressTimer.current) clearInterval(analyzeProgressTimer.current);
      setError(
        err instanceof Error ? err.message : 'An error occurred during analysis',
      );
      setAnalysisResult(null);
      setStage(null);
    }
  };

  return (
    <AppShell
      title="Dashboard"
      subtitle="Intelligent document analysis for bid recommendations"
      actions={
        <Link
          href="/bids"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          View Bid History
        </Link>
      }
    >
      <div className="space-y-8">
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Bids Analyzed" value={String(stats.total)} icon="📊" accent="blue" />
            <StatCard
              label="Recommended to Bid"
              value={`${stats.recommendedPercent}%`}
              icon="✅"
              accent="green"
            />
            <StatCard
              label="Average Risk Score"
              value={`${stats.avgRiskPercent}%`}
              icon="⚠️"
              accent="amber"
            />
          </div>
        )}

        <div className="space-y-8">
          {/* Upload Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Upload Document
              </h2>
              {(uploadedFileName || analysisResult) && !isProcessing && (
                <button
                  onClick={() => {
                    setUploadedFileName(null);
                    setUploadedFile(null);
                    setExtractedText(null);
                    setAnalysisResult(null);
                    setError(null);
                    setStage(null);
                    setProgress(0);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  ← Upload Another Document
                </button>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Upload a construction document (PDF, contract, specification, BOQ, drawing, or
              addendum) for automatic analysis.
            </p>
            <UploadForm
              onUploadSuccess={handleUploadSuccess}
              onUploadStart={handleUploadStart}
              onUploadProgress={setProgress}
              disabled={isProcessing}
            />

            {uploadedFileName && !isProcessing && stage !== 'done' && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-2">
                  <span>✅</span>
                  File uploaded: <span className="font-mono">{uploadedFileName}</span>
                </p>
              </div>
            )}

            {stage && <ProcessProgress stage={stage} percent={progress} />}

            {error && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-700 dark:text-red-400 font-semibold">Error</p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
              </div>
            )}
          </div>

          {/* Features Section */}
          {!analysisResult && !isProcessing && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-3xl mb-2">📄</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Document Extraction
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Automatic text extraction from PDF documents
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-3xl mb-2">🏷️</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Classification
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Identify document type: contract, spec, BOQ, drawing, addendum
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-3xl mb-2">⚖️</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Multi-Agent Analysis
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Legal, engineering, accounting, and risk assessments
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-3xl mb-2">💰</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Bid Recommendations
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Intelligent pricing and bid strategy suggestions
                </p>
              </div>
            </div>
          )}

          {/* Results Section */}
          {analysisResult && (
            <div className="space-y-6">
              <ResultsView result={analysisResult} />

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Bid ID: <span className="font-mono text-sm">{analysisResult.id}</span>
                </p>
                <Link
                  href={`/bid/${analysisResult.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-2 inline-block"
                >
                  View full bid details →
                </Link>
              </div>

              {/* Bid Decision & Risk Analysis */}
              {(() => {
                const risk = analysisResult.riskAssessment;
                const decision = String(risk?.bid_decision || '').toUpperCase();
                const isYes = decision === 'YES';
                const needsManualReview = decision === 'MANUAL_REVIEW';
                const riskLevel = String(risk?.risk_level || 'N/A');
                const riskScore = risk?.risk_score == null ? null : Number(risk.risk_score);
                const riskFactors = Array.isArray(risk?.risk_factors)
                  ? (risk.risk_factors as string[])
                  : [];
                const mitigations = Array.isArray(risk?.mitigation_strategies)
                  ? (risk.mitigation_strategies as string[])
                  : [];
                const bid = analysisResult.bidRecommendation;
                const recommendedBidPrice = Number(bid?.recommended_bid_price || 0);
                const totalProjectCost = Number(bid?.estimated_cost || 0);
                const marginPercentage = Number(bid?.bid_margin_percentage || 0);
                const profitAmount = Number(bid?.profit_amount || 0);

                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <div
                      className={`p-8 text-center ${
                        isYes
                          ? 'bg-green-50 dark:bg-green-950/40 border-b-2 border-green-300 dark:border-green-700'
                          : needsManualReview
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-b-2 border-amber-300 dark:border-amber-700'
                            : 'bg-red-50 dark:bg-red-950/40 border-b-2 border-red-300 dark:border-red-700'
                      }`}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Recommended to Bid?
                      </p>
                      <p
                        className={`font-extrabold text-6xl ${
                          isYes ? 'text-green-600 dark:text-green-400' : needsManualReview ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {needsManualReview ? 'MANUAL REVIEW REQUIRED' : decision || 'N/A'}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 mt-3">
                        {needsManualReview
                          ? 'Part of the automated analysis failed - no bid decision can be made from an incomplete assessment.'
                          : `Based on ${riskLevel} risk (${((riskScore ?? 0) * 100).toFixed(0)}% risk score)`}
                      </p>
                      {risk?.recommendation_rationale ? (
                        <p className="text-gray-700 dark:text-gray-300 mt-4 max-w-2xl mx-auto">
                          {String(risk.recommendation_rationale)}
                        </p>
                      ) : null}

                      {isYes && recommendedBidPrice > 0 && (
                        <div className="mt-6 inline-block bg-white dark:bg-gray-800 rounded-lg border-2 border-green-300 dark:border-green-700 px-8 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Recommended Bid Amount
                          </p>
                          <p className="font-extrabold text-4xl text-green-700 dark:text-green-400">
                            ${recommendedBidPrice.toLocaleString()}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                            Total Project Cost: ${totalProjectCost.toLocaleString()} +{' '}
                            {marginPercentage.toFixed(0)}% margin
                            {profitAmount > 0 && (
                              <> (${profitAmount.toLocaleString()} profit)</>
                            )}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 max-w-md">
                            Priced to balance winning chances with profitability given the
                            assessed risk level.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          Risk Factors
                        </h3>
                        {riskFactors.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1">
                            {riskFactors.map((factor, idx) => (
                              <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                                {factor}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            No significant risk factors identified.
                          </p>
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          Mitigation Strategies
                        </h3>
                        {mitigations.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1">
                            {mitigations.map((strategy, idx) => (
                              <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                                {strategy}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            No mitigation strategies required.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
