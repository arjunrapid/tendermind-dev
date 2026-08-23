'use client';

import { useState } from 'react';
import Link from 'next/link';
import UploadForm from '@/components/UploadForm';
import ResultsView from '@/components/ResultsView';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    null,
  );

  const handleUploadSuccess = async (data: {
    fileName: string;
    extractedText: string;
  }) => {
    setUploadedFileName(data.fileName);
    setAnalysisResult(null);
    setIsAnalyzing(true);
    setError(null);

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
      setAnalysisResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred during analysis',
      );
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Construction Bid Analyzer
              </h1>
              <p className="text-gray-600 mt-1">
                Intelligent document analysis for bid recommendations
              </p>
            </div>
            <nav className="flex gap-3">
              <Link
                href="/admin"
                className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Admin
              </Link>
              <Link
                href="/bids"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Bid History
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-gray-900">
                Upload Document
              </h2>
              {(uploadedFileName || analysisResult) && (
                <button
                  onClick={() => {
                    setUploadedFileName(null);
                    setAnalysisResult(null);
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  ← Upload Another Document
                </button>
              )}
            </div>
            <p className="text-gray-600 mb-6">
              Upload a construction document (PDF, contract, specification, BOQ, drawing, or
              addendum) for automatic analysis.
            </p>
            <UploadForm
              onUploadSuccess={handleUploadSuccess}
              onLoading={setIsAnalyzing}
            />

            {uploadedFileName && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm font-medium flex items-center gap-2">
                  <span>✅</span>
                  File uploaded: <span className="font-mono">{uploadedFileName}</span>
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="mt-6">
                <p className="text-gray-700 text-sm font-medium mb-2">
                  Analyzing document — running classification and agent workflows...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-blue-600 h-3 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-700 font-semibold">Error</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            )}
          </div>

          {/* Features Section */}
          {!analysisResult && !isAnalyzing && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-3xl mb-2">📄</div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Document Extraction
                </h3>
                <p className="text-gray-600 text-sm">
                  Automatic text extraction from PDF documents
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-3xl mb-2">🏷️</div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Classification
                </h3>
                <p className="text-gray-600 text-sm">
                  Identify document type: contract, spec, BOQ, drawing, addendum
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-3xl mb-2">⚖️</div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Multi-Agent Analysis
                </h3>
                <p className="text-gray-600 text-sm">
                  Legal, engineering, accounting, and risk assessments
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-3xl mb-2">💰</div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Bid Recommendations
                </h3>
                <p className="text-gray-600 text-sm">
                  Intelligent pricing and bid strategy suggestions
                </p>
              </div>
            </div>
          )}

          {/* Results Section */}
          {analysisResult && (
            <div className="space-y-6">
              <ResultsView result={analysisResult} />

              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600">
                  Bid ID: <span className="font-mono text-sm">{analysisResult.id}</span>
                </p>
                <Link
                  href={`/bid/${analysisResult.id}`}
                  className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                >
                  View full bid details →
                </Link>
              </div>

              {/* Bid Decision & Risk Analysis */}
              {(() => {
                const risk = analysisResult.riskAssessment;
                const decision = String(risk?.bid_decision || '').toUpperCase();
                const isYes = decision === 'YES';
                const riskLevel = String(risk?.risk_level || 'N/A');
                const riskScore = Number(risk?.risk_score || 0);
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
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div
                      className={`p-8 text-center ${
                        isYes
                          ? 'bg-green-50 border-b-2 border-green-300'
                          : 'bg-red-50 border-b-2 border-red-300'
                      }`}
                    >
                      <p className="text-sm text-gray-600 mb-2">
                        Recommended to Bid?
                      </p>
                      <p
                        className={`font-extrabold text-6xl ${
                          isYes ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {decision || 'N/A'}
                      </p>
                      <p className="text-gray-600 mt-3">
                        Based on {riskLevel} risk ({(riskScore * 100).toFixed(0)}% risk score)
                      </p>
                      {risk?.recommendation_rationale ? (
                        <p className="text-gray-700 mt-4 max-w-2xl mx-auto">
                          {String(risk.recommendation_rationale)}
                        </p>
                      ) : null}

                      {isYes && recommendedBidPrice > 0 && (
                        <div className="mt-6 inline-block bg-white rounded-lg border-2 border-green-300 px-8 py-4">
                          <p className="text-sm text-gray-600">
                            Recommended Bid Amount
                          </p>
                          <p className="font-extrabold text-4xl text-green-700">
                            ${recommendedBidPrice.toLocaleString()}
                          </p>
                          <p className="text-gray-600 text-sm mt-2">
                            Total Project Cost: ${totalProjectCost.toLocaleString()} +{' '}
                            {marginPercentage.toFixed(0)}% margin
                            {profitAmount > 0 && (
                              <> (${profitAmount.toLocaleString()} profit)</>
                            )}
                          </p>
                          <p className="text-gray-500 text-xs mt-1 max-w-md">
                            Priced to balance winning chances with profitability given the
                            assessed risk level.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Risk Factors
                        </h3>
                        {riskFactors.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1">
                            {riskFactors.map((factor, idx) => (
                              <li key={idx} className="text-gray-700 text-sm">
                                {factor}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 text-sm">
                            No significant risk factors identified.
                          </p>
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Mitigation Strategies
                        </h3>
                        {mitigations.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1">
                            {mitigations.map((strategy, idx) => (
                              <li key={idx} className="text-gray-700 text-sm">
                                {strategy}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 text-sm">
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
    </main>
  );
}
