/**
 * Shared runner for tender scenario test scripts.
 * Runs the full agent pipeline (classify -> legal/engineering/accounting -> risk -> pricing)
 * against a tender document and prints the resulting bid recommendation.
 */

import { classifyDocument } from '@/lib/classifier';
import { legalAgent } from '@/lib/agents/legal-agent';
import { engineeringAgent } from '@/lib/agents/engineering-agent';
import { accountingAgent } from '@/lib/agents/accounting-agent';
import { riskAgent } from '@/lib/agents/risk-agent';
import { calculatePricingFromDocument } from '@/lib/pricing-engine';

export async function runTenderScenario(scenarioName: string, bidId: string, tenderText: string) {
  console.log('\n' + '='.repeat(70));
  console.log(scenarioName);
  console.log('='.repeat(70));

  const classification = classifyDocument(tenderText);
  console.log(`Document Type: ${classification.doc_type} (confidence ${(classification.confidence * 100).toFixed(1)}%)`);

  const [legal, engineering, accounting] = await Promise.all([
    legalAgent(tenderText, bidId, classification.doc_type),
    engineeringAgent(tenderText, bidId, classification.doc_type),
    accountingAgent(tenderText, bidId, classification.doc_type),
  ]);

  console.log(`Legal: ${legal.overall_assessment} | issues=${legal.compliance_issues.length} risks=${legal.risks.length}`);
  console.log(`Engineering: feasibility=${engineering.feasibility} | concerns=${engineering.structural_concerns.length}`);
  console.log(`Accounting: cash_flow=${accounting.cash_flow_analysis?.slice(0, 60)}...`);

  const risk = riskAgent(legal, engineering, accounting);
  const pricing = calculatePricingFromDocument(tenderText);

  console.log();
  console.log(`Risk Score: ${risk.risk_score} (${risk.risk_level})`);
  console.log(`Recommendation: ${risk.recommendation} (bid_decision=${risk.bid_decision})`);
  console.log(`Rationale: ${risk.recommendation_rationale}`);
  console.log(`Recommended Bid Price: $${pricing.recommended_bid_price.toLocaleString()}`);
  console.log();

  return { classification, legal, engineering, accounting, risk, pricing };
}
