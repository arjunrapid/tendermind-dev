'use client';

import { useState } from 'react';

interface AgentResult {
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

interface ResultsViewProps {
  result: AgentResult;
}

export default function ResultsView({ result }: ResultsViewProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'legal' | 'engineering' | 'accounting' | 'risk' | 'bid' | 'summary'
  >('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'legal', label: 'Legal' },
    { id: 'engineering', label: 'Engineering' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'risk', label: 'Risk' },
    { id: 'bid', label: 'Bid Recommendation' },
    { id: 'summary', label: 'Summary' },
  ];

  return (
    <div className="w-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(
                  tab.id as
                    | 'overview'
                    | 'legal'
                    | 'engineering'
                    | 'accounting'
                    | 'risk'
                    | 'bid'
                    | 'summary',
                )
              }
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">File Name</p>
                <p className="font-semibold">{result.fileName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Document Type</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {result.classification.doc_type}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {(result.classification.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className="font-semibold text-lg">
                  {(result.riskAssessment?.risk_level as string) || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Risk Score</p>
                <p className="font-semibold text-lg">
                  {(
                    ((result.riskAssessment?.risk_score as number) || 0) * 100
                  ).toFixed(0)}%
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Confidence</p>
                <p className="font-semibold text-lg">
                  {(
                    (result.bidRecommendation?.confidence_score as number) ||
                    0
                  ) * 100}%
                </p>
              </div>
            </div>

            {result.bidRecommendation?.agent_timings_ms ? (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-2">Agent Run Times</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(() => {
                    const timings = result.bidRecommendation.agent_timings_ms as {
                      legal_ms: number;
                      engineering_ms: number;
                      accounting_ms: number;
                      risk_ms: number;
                      agents_wall_clock_ms: number;
                    };
                    const rows: Array<[string, number]> = [
                      ['Legal', timings.legal_ms],
                      ['Engineering', timings.engineering_ms],
                      ['Accounting', timings.accounting_ms],
                      ['Risk', timings.risk_ms],
                    ];
                    return rows.map(([label, ms]) => (
                      <div key={label} className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">{label}</p>
                        <p className="font-semibold text-lg">
                          {(ms / 1000).toFixed(1)}s
                        </p>
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Legal, Engineering, and Accounting run concurrently, so total wall-clock
                  time is roughly the slowest of the three (
                  {(
                    (
                      (result.bidRecommendation.agent_timings_ms as {
                        agents_wall_clock_ms: number;
                      }).agents_wall_clock_ms || 0
                    ) / 1000
                  ).toFixed(1)}
                  s) plus Risk aggregation, not the sum of all four.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Assessment</h3>
              <p className="text-gray-700">
                {String(result.legalAssessment?.overall_assessment || 'No data')}
              </p>
            </div>

            {result.legalAssessment?.compliance_issues &&
              Array.isArray(result.legalAssessment.compliance_issues) ? (
                <div>
                  <h3 className="font-semibold mb-2">Compliance Issues</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {(result.legalAssessment.compliance_issues as string[]).map(
                      (issue: string, idx: number) => (
                        <li key={idx} className="text-gray-700">
                          {issue}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}

            {result.legalAssessment?.risks &&
              Array.isArray(result.legalAssessment.risks) ? (
                <div>
                  <h3 className="font-semibold mb-2">Legal Risks</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {(result.legalAssessment.risks as string[]).map(
                      (risk: string, idx: number) => (
                        <li key={idx} className="text-gray-700">
                          {risk}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}
          </div>
        )}

        {activeTab === 'engineering' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Feasibility</h3>
              <p className="text-gray-700">
                {String(result.engineeringAssessment?.feasibility || 'No data')}
              </p>
            </div>

            {result.engineeringAssessment?.timeline_estimate ? (
              <div>
                <h3 className="font-semibold mb-2">Timeline Estimate</h3>
                <p className="text-gray-700">
                  {String(result.engineeringAssessment.timeline_estimate)}
                </p>
              </div>
            ) : null}

            {result.engineeringAssessment?.structural_concerns &&
              Array.isArray(result.engineeringAssessment.structural_concerns) ? (
                <div>
                  <h3 className="font-semibold mb-2">Structural Concerns</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {(
                      result.engineeringAssessment
                        .structural_concerns as string[]
                    ).map((concern: string, idx: number) => (
                      <li key={idx} className="text-gray-700">
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
          </div>
        )}

        {activeTab === 'accounting' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Material Costs</p>
                <p className="font-semibold text-lg">
                  ${Number(result.accountingAssessment?.material_costs || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Labor Costs</p>
                <p className="font-semibold text-lg">
                  ${Number(result.accountingAssessment?.labor_costs || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Estimated Cost</p>
              <p className="font-semibold text-2xl">
                $
                {Number(result.accountingAssessment?.total_estimated_cost || 0).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Contingency</p>
              <p className="font-semibold">
                {String(result.accountingAssessment?.contingency_percentage || 0)}%
              </p>
            </div>

            {Array.isArray(result.accountingAssessment?.boq_breakdown) ? (
              <div>
                <h3 className="font-semibold mb-2">Default Cost Item Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b border-gray-200">
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 pr-4">Quantity</th>
                        <th className="py-2 pr-4">Rate</th>
                        <th className="py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        result.accountingAssessment.boq_breakdown as Array<{
                          name: string;
                          item_type: string;
                          quantity: number | null;
                          unit: string | null;
                          unit_rate: number | null;
                          lump_sum_amount: number | null;
                          amount: number;
                        }>
                      ).map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-900">{item.name}</td>
                          <td className="py-2 pr-4 text-gray-700">
                            {item.item_type === 'measured'
                              ? `${item.quantity} ${item.unit}`
                              : 'Lump sum'}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            {item.item_type === 'measured'
                              ? `$${Number(item.unit_rate).toLocaleString()}/${item.unit}`
                              : '—'}
                          </td>
                          <td className="py-2 font-semibold text-gray-900">
                            ${item.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
              <p className="text-sm text-gray-600">Risk Level Assessment</p>
              <p className="font-semibold text-lg">
                {String(result.riskAssessment?.risk_level || 'N/A')}
              </p>
              <p className="text-2xl font-bold mt-2">
                {(
                  ((result.riskAssessment?.risk_score as number) || 0) * 100
                ).toFixed(0)}%
              </p>
            </div>

            {result.riskAssessment?.risk_factors &&
              Array.isArray(result.riskAssessment.risk_factors) ? (
                <div>
                  <h3 className="font-semibold mb-2">Risk Factors</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {(result.riskAssessment.risk_factors as string[]).map(
                      (factor: string, idx: number) => (
                        <li key={idx} className="text-gray-700">
                          {factor}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}

            {result.riskAssessment?.mitigation_strategies &&
              Array.isArray(result.riskAssessment.mitigation_strategies) ? (
                <div>
                  <h3 className="font-semibold mb-2">Mitigation Strategies</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {(
                      result.riskAssessment.mitigation_strategies as string[]
                    ).map((strategy: string, idx: number) => (
                      <li key={idx} className="text-gray-700">
                        {strategy}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
          </div>
        )}

        {activeTab === 'bid' && (
          <div className="space-y-4">
            {(() => {
              const isYes =
                String(result.bidRecommendation?.bid_decision || '').toUpperCase() ===
                'YES';
              return (
                <div
                  className={`p-6 rounded-lg border-2 ${
                    isYes
                      ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p className="text-sm text-gray-600">
                    {isYes ? 'Recommended Bid Price' : 'Reference Price (bid not recommended)'}
                  </p>
                  <p
                    className={`font-bold text-4xl ${
                      isYes ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    $
                    {Number(
                      result.bidRecommendation?.recommended_bid_price || 0
                    ).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Total Project Cost: $
                    {Number(result.bidRecommendation?.estimated_cost || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Margin: {Number(result.bidRecommendation?.bid_margin_percentage || 0).toFixed(0)}%
                    {result.bidRecommendation?.profit_amount != null && (
                      <> (${Number(result.bidRecommendation.profit_amount).toLocaleString()} profit)</>
                    )}
                  </p>
                  {result.bidRecommendation?.pricing_strategy_rationale ? (
                    <p className="text-gray-700 text-sm mt-3">
                      {String(result.bidRecommendation.pricing_strategy_rationale)}
                    </p>
                  ) : null}
                </div>
              );
            })()}

            <div>
              <h3 className="font-semibold mb-2">Recommendation</h3>
              <p className="text-gray-700 text-lg">
                {String(result.bidRecommendation?.recommendation || 'N/A')}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Overall Confidence</p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Number(result.bidRecommendation?.confidence_score || 0) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold">
                {(
                  Number(result.bidRecommendation?.confidence_score || 0) * 100
                ).toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-6">
            {(() => {
              const decision = String(
                result.riskAssessment?.bid_decision || '',
              ).toUpperCase();
              const isYes = decision === 'YES';
              const riskScore = Number(result.riskAssessment?.risk_score || 0);
              const riskLevel = String(result.riskAssessment?.risk_level || 'N/A');

              return (
                <div
                  className={`p-8 rounded-lg border-2 text-center ${
                    isYes
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'
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
                </div>
              );
            })()}

            <div>
              <h3 className="font-semibold mb-2">Contract Summary</h3>
              <p className="text-gray-700 leading-relaxed">
                {String(
                  result.riskAssessment?.contract_summary ||
                    'No summary available.',
                )}
              </p>
            </div>

            {result.riskAssessment?.recommendation_rationale ? (
              <div>
                <h3 className="font-semibold mb-2">Why</h3>
                <p className="text-gray-700 leading-relaxed">
                  {String(result.riskAssessment.recommendation_rationale)}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
