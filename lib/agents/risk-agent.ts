/**
 * Risk Agent
 * Aggregates findings from all other agents and provides final bid recommendation
 * Does not call LLM - purely deterministic aggregation
 */

import { LegalAssessment } from './legal-agent';
import { EngineeringAssessment } from './engineering-agent';
import { AccountingAssessment } from './accounting-agent';

/**
 * Extracts the agent's rating (GREEN/YELLOW/RED or HIGH/MEDIUM/LOW) from the
 * front of a free-form assessment string, e.g. "YELLOW: The contract..." or
 * "HIGH - The project has...". Both agents are prompted to lead with the
 * rating, so anchoring the match there (rather than searching the whole
 * body) avoids false positives: a plain `.includes('LOW')` would also match
 * a feasibility narrative that merely quotes the source document's own
 * "LOW risk" self-classification, or `.includes('RED')` matching inside an
 * unrelated word like "prepared". Returns null if no candidate rating is
 * found at the start.
 */
function extractLeadingRating(text: string, candidates: string[]): string | null {
  const trimmed = text.trim();
  for (const word of candidates) {
    if (new RegExp(`^${word}\\b`, 'i').test(trimmed)) {
      return word;
    }
  }
  return null;
}

function hasRatingWord(text: string, word: string): boolean {
  return extractLeadingRating(text, [word]) !== null;
}

export interface RiskAssessment {
  risk_score: number | null; // 0.0 to 1.0, null when bid_decision is MANUAL_REVIEW
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  risk_factors: string[];
  mitigation_strategies: string[];
  recommendation: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'DO_NOT_PROCEED' | 'MANUAL_REVIEW_REQUIRED';
  recommendation_rationale: string;
  aggregated_findings: string;
  contract_summary: string;
  bid_decision: 'YES' | 'NO' | 'MANUAL_REVIEW';
}

/** Which upstream agents failed (marked `provider_used: 'error'` by their
 * own catch block rather than throwing) - used to force a MANUAL_REVIEW
 * decision instead of computing a risk score/bid price from a partial,
 * silently-degraded analysis that would look exactly as confident as a
 * complete one. */
function failedAgents(
  legal: LegalAssessment,
  engineering: EngineeringAssessment,
  accounting: AccountingAssessment,
): string[] {
  const failed: string[] = [];
  if (legal.provider_used === 'error') failed.push('legal');
  if (engineering.provider_used === 'error') failed.push('engineering');
  if (accounting.provider_used === 'error') failed.push('accounting');
  return failed;
}

function manualReviewResult(failed: string[]): RiskAssessment {
  const agentsStr = failed.join(', ');
  return {
    risk_score: null,
    risk_level: 'UNKNOWN',
    risk_factors: failed.map((agent) => `${agent.charAt(0).toUpperCase()}${agent.slice(1)} agent analysis failed - automated result unavailable`),
    mitigation_strategies: [
      'Have a qualified reviewer manually assess this document before making a bid decision.',
      'Re-run automated analysis once the underlying issue is resolved (check LLM provider/API key configuration and logs).',
    ],
    recommendation: 'MANUAL_REVIEW_REQUIRED',
    recommendation_rationale: `Automated analysis failed for: ${agentsStr}. No bid recommendation can be made from an incomplete assessment - this document requires manual review before any bid decision.`,
    aggregated_findings: `Analysis incomplete - ${agentsStr} agent(s) failed. Manual review required.`,
    contract_summary: 'Unable to generate a reliable summary - part of the automated analysis failed. Manual review required.',
    bid_decision: 'MANUAL_REVIEW',
  };
}

/**
 * Risk Agent - Aggregates all findings into a final recommendation
 */
export function riskAgent(
  legal: LegalAssessment,
  engineering: EngineeringAssessment,
  accounting: AccountingAssessment,
): RiskAssessment {
  console.log('[Risk Agent] Starting aggregation and risk analysis');

  const failed = failedAgents(legal, engineering, accounting);
  if (failed.length > 0) {
    return manualReviewResult(failed);
  }

  try {
    // Extract risk factors from each agent
    const legalRisks = extractLegalRisks(legal);
    const engineeringRisks = extractEngineeringRisks(engineering);
    const accountingRisks = extractAccountingRisks(accounting);

    // Calculate overall risk score (0.0 = no risk, 1.0 = maximum risk)
    const riskScore = calculateRiskScore(
      legal,
      engineering,
      legalRisks,
      engineeringRisks,
      accountingRisks,
    );

    // Determine risk level
    const riskLevel = getRiskLevel(riskScore);

    // Aggregate all risk factors
    const allRiskFactors = [...legalRisks, ...engineeringRisks, ...accountingRisks];

    // Generate mitigation strategies
    const mitigationStrategies = generateMitigationStrategies(
      legalRisks,
      engineeringRisks,
      accountingRisks,
    );

    // Determine final recommendation
    const recommendation = getRecommendation(
      riskLevel,
      legalRisks.length,
      engineeringRisks.length,
      accountingRisks.length,
    );

    const rationale = generateRationale(
      legal,
      engineering,
      accounting,
      riskLevel,
      recommendation,
    );

    const aggregatedFindings = generateAggregatedFindings(legal, engineering, accounting);
    const contractSummary = generateContractSummary(legal, engineering, accounting);

    // Binary decision collapses the three-state `recommendation` above into
    // yes/no for display. Deriving from `recommendation` (not risk_level
    // directly) matters: `recommendation` also applies safety overrides for
    // saturated risk counts (e.g. legal risks > 8) that risk_level alone
    // can miss when other dimensions (like a failed accounting parse) drag
    // the weighted average down - without this, bid_decision could say YES
    // on a contract recommendation already flagged DO_NOT_PROCEED.
    const bidDecision: 'YES' | 'NO' = recommendation === 'DO_NOT_PROCEED' ? 'NO' : 'YES';

    const result: RiskAssessment = {
      risk_score: Math.round(riskScore * 1000) / 1000,
      risk_level: riskLevel,
      risk_factors: allRiskFactors,
      mitigation_strategies: mitigationStrategies,
      recommendation,
      recommendation_rationale: rationale,
      aggregated_findings: aggregatedFindings,
      contract_summary: contractSummary,
      bid_decision: bidDecision,
    };

    console.log(`[Risk Agent] Risk assessment complete: ${riskLevel} (score: ${result.risk_score})`);
    return result;
  } catch (error) {
    console.error('[Risk Agent] Error during analysis:', error);
    return manualReviewResult(['risk aggregation']);
  }
}

/**
 * Extract risk factors from legal assessment
 */
function extractLegalRisks(legal: LegalAssessment): string[] {
  const risks: string[] = [];

  // Add compliance issues as risks
  if (legal.compliance_issues && Array.isArray(legal.compliance_issues)) {
    legal.compliance_issues.forEach((issue) => {
      if (typeof issue === 'string' && issue.trim()) {
        risks.push(`Legal - Compliance: ${issue}`);
      }
    });
  }

  // Add contract risks
  if (legal.risks && Array.isArray(legal.risks)) {
    legal.risks.forEach((risk) => {
      if (typeof risk === 'string' && risk.trim()) {
        risks.push(`Legal - Contract Risk: ${risk}`);
      }
    });
  }

  // Check overall assessment for RED flag
  if (legal.overall_assessment && hasRatingWord(String(legal.overall_assessment), 'RED')) {
    risks.push('Legal - Overall assessment is RED: major legal issues identified');
  }

  return risks;
}

/**
 * Extract risk factors from engineering assessment
 */
function extractEngineeringRisks(engineering: EngineeringAssessment): string[] {
  const risks: string[] = [];

  // Add structural concerns as risks
  if (engineering.structural_concerns && Array.isArray(engineering.structural_concerns)) {
    engineering.structural_concerns.forEach((concern) => {
      if (typeof concern === 'string' && concern.trim()) {
        risks.push(`Engineering - Technical: ${concern}`);
      }
    });
  }

  // Check feasibility
  if (engineering.feasibility && typeof engineering.feasibility === 'string') {
    if (hasRatingWord(engineering.feasibility, 'LOW')) {
      risks.push('Engineering - Low feasibility: project may be difficult to execute');
    } else if (hasRatingWord(engineering.feasibility, 'MEDIUM')) {
      risks.push('Engineering - Medium feasibility: execution challenges identified');
    }
  }

  // Check timeline - if estimate is too aggressive
  if (
    engineering.timeline_estimate &&
    typeof engineering.timeline_estimate === 'string'
  ) {
    if (
      engineering.timeline_estimate.toLowerCase().includes('aggressive') ||
      engineering.timeline_estimate.toLowerCase().includes('tight')
    ) {
      risks.push('Engineering - Timeline: aggressive schedule may impact quality');
    }
  }

  return risks;
}

/**
 * Extract risk factors from accounting assessment
 */
function extractAccountingRisks(accounting: AccountingAssessment): string[] {
  const risks: string[] = [];

  // Add qualification concerns
  if (accounting.qualification_requirements && Array.isArray(accounting.qualification_requirements)) {
    accounting.qualification_requirements.forEach((req) => {
      if (
        typeof req === 'string' &&
        req.trim() &&
        (req.toLowerCase().includes('challenging') || req.toLowerCase().includes('strict'))
      ) {
        risks.push(`Accounting - Qualification Risk: ${req}`);
      }
    });
  }

  // Check for high retention or complex payment terms
  if (accounting.payment_terms && Array.isArray(accounting.payment_terms)) {
    accounting.payment_terms.forEach((term) => {
      if (
        typeof term === 'string' &&
        (term.toLowerCase().includes('retention') ||
          term.toLowerCase().includes('holdback'))
      ) {
        risks.push(`Accounting - Cash Flow: ${term}`);
      }
    });
  }

  // Check cash flow analysis
  if (accounting.cash_flow_analysis && typeof accounting.cash_flow_analysis === 'string') {
    if (
      accounting.cash_flow_analysis.toLowerCase().includes('tight') ||
      accounting.cash_flow_analysis.toLowerCase().includes('negative')
    ) {
      risks.push('Accounting - Cash Flow: Project may create working capital pressure');
    }
  }

  return risks;
}

/**
 * Calculate overall risk score from all risk categories.
 *
 * A pure item-count score doesn't work here: any real contract review lists
 * 5-10 items per category just by cataloguing standard clauses (liability
 * cap, warranty, LDs, retention, etc.) whether or not those terms are
 * actually unfavorable. Counting alone clustered almost every document
 * around ~0.55-0.70, regardless of content - the qualitative rating each
 * agent already gives (legal GREEN/YELLOW/RED, engineering feasibility) is
 * the real severity signal and now carries most of the weight; the item
 * count is kept only as a smaller modifier so an unusually long list of
 * concerns still nudges the score up within its severity band.
 */
function calculateRiskScore(
  legal: LegalAssessment,
  engineering: EngineeringAssessment,
  legalRisks: string[],
  engineeringRisks: string[],
  accountingRisks: string[],
): number {
  const countFactor = (count: number, cap: number) => Math.min(count / cap, 1.0);

  const legalRating = ratingToScore(String(legal.overall_assessment || ''));
  const legalComponent =
    legalRating * 0.65 + countFactor(legalRisks.length, 12) * 0.35;

  const feasibilityRating = feasibilityToScore(String(engineering.feasibility || ''));
  const engineeringComponent =
    feasibilityRating * 0.65 + countFactor(engineeringRisks.length, 10) * 0.35;

  // Accounting assessments don't carry an explicit rating field, so stay
  // count-based here.
  const accountingComponent = countFactor(accountingRisks.length, 10);

  return legalComponent * 0.4 + engineeringComponent * 0.35 + accountingComponent * 0.25;
}

/**
 * Maps the legal agent's GREEN/YELLOW/RED rating to a 0-1 severity score.
 * Defaults to the mid (YELLOW) severity when the agent didn't return a
 * recognizable rating, rather than silently scoring as risk-free.
 */
function ratingToScore(overallAssessment: string): number {
  if (hasRatingWord(overallAssessment, 'RED')) return 0.9;
  if (hasRatingWord(overallAssessment, 'GREEN')) return 0.15;
  return 0.5; // YELLOW or unrecognized
}

/**
 * Maps the engineering agent's HIGH/MEDIUM/LOW feasibility rating to a 0-1
 * severity score (LOW feasibility = high risk).
 */
function feasibilityToScore(feasibility: string): number {
  if (hasRatingWord(feasibility, 'LOW')) return 0.9;
  if (hasRatingWord(feasibility, 'HIGH')) return 0.15;
  return 0.5; // MEDIUM or unrecognized
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score < 0.33) return 'LOW';
  if (score < 0.67) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Generate mitigation strategies
 */
function generateMitigationStrategies(
  legalRisks: string[],
  engineeringRisks: string[],
  accountingRisks: string[],
): string[] {
  const strategies: string[] = [];

  // Legal mitigation
  if (legalRisks.length > 0) {
    strategies.push('Obtain legal counsel to negotiate critical contract terms');
    strategies.push('Establish clear change order and dispute resolution processes');
    strategies.push('Secure appropriate insurance coverage for identified risks');
  }

  // Engineering mitigation
  if (engineeringRisks.length > 0) {
    strategies.push('Conduct detailed site investigation and baseline survey');
    strategies.push('Establish contingency reserves for technical uncertainties');
    strategies.push('Identify and qualify key subcontractors and suppliers');
    strategies.push('Develop detailed project methodology and schedule');
  }

  // Accounting mitigation
  if (accountingRisks.length > 0) {
    strategies.push('Maintain adequate working capital reserve');
    strategies.push('Negotiate favorable payment terms and milestone triggers');
    strategies.push('Establish clear financial controls and cost tracking');
    strategies.push('Consider early payment discounts or payment plan optimization');
  }

  return strategies.slice(0, 6); // Return top 6 strategies
}

/**
 * Get final recommendation
 */
function getRecommendation(
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  legalRiskCount: number,
  engineeringRiskCount: number,
  accountingRiskCount: number,
): 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'DO_NOT_PROCEED' {
  // Critical failures
  if (legalRiskCount > 8) return 'DO_NOT_PROCEED';
  if (engineeringRiskCount > 7) return 'DO_NOT_PROCEED';

  // High risk overall
  if (riskLevel === 'HIGH') return 'DO_NOT_PROCEED';

  // Medium risk - the hard caps above already catch an excessive raw count
  // of issues regardless of level, so a MEDIUM severity rating proceeds with
  // caution rather than being re-escalated by the same counts.
  if (riskLevel === 'MEDIUM') {
    return 'PROCEED_WITH_CAUTION';
  }

  // Low risk
  return 'PROCEED';
}

/**
 * Generate recommendation rationale
 */
function generateRationale(
  legal: LegalAssessment,
  engineering: EngineeringAssessment,
  accounting: AccountingAssessment,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  recommendation: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'DO_NOT_PROCEED',
): string {
  let rationale = '';

  // Legal assessment
  if (legal.overall_assessment && typeof legal.overall_assessment === 'string') {
    if (hasRatingWord(legal.overall_assessment, 'RED')) {
      rationale += 'Legal assessment is RED - significant contract issues. ';
    } else if (hasRatingWord(legal.overall_assessment, 'YELLOW')) {
      rationale += 'Legal assessment is YELLOW - negotiation needed. ';
    } else {
      rationale += 'Legal assessment is GREEN - contract terms acceptable. ';
    }
  }

  // Engineering assessment
  if (engineering.feasibility && typeof engineering.feasibility === 'string') {
    if (hasRatingWord(engineering.feasibility, 'LOW')) {
      rationale += 'Engineering feasibility is LOW - execution risks high. ';
    } else if (hasRatingWord(engineering.feasibility, 'MEDIUM')) {
      rationale += 'Engineering feasibility is MEDIUM - manageable with planning. ';
    } else {
      rationale += 'Engineering feasibility is HIGH - project is executable. ';
    }
  }

  // Risk level summary
  if (riskLevel === 'HIGH') {
    rationale += 'Overall risk profile is HIGH - ';
    switch (recommendation) {
      case 'DO_NOT_PROCEED':
        rationale += 'recommend declining this bid or major scope reduction.';
        break;
      case 'PROCEED_WITH_CAUTION':
        rationale += 'proceed only with strong mitigation strategies in place.';
        break;
      case 'PROCEED':
        rationale += 'proceed with comprehensive risk management plan.';
        break;
    }
  } else if (riskLevel === 'MEDIUM') {
    rationale += 'Overall risk profile is MEDIUM - ';
    switch (recommendation) {
      case 'DO_NOT_PROCEED':
        rationale += 'consider declining unless significant improvements possible.';
        break;
      case 'PROCEED_WITH_CAUTION':
        rationale += 'proceed with negotiation of key terms and mitigation strategies.';
        break;
      case 'PROCEED':
        rationale += 'proceed with standard risk controls in place.';
        break;
    }
  } else {
    rationale += 'Overall risk profile is LOW - ';
    rationale += 'this is a strong bidding opportunity.';
  }

  return rationale;
}

/**
 * Strip inline citation brackets (e.g. "[page:3, Clause 3.2]") for
 * display in prose - citations belong in the detailed tabs, not the
 * executive summary.
 */
function stripCitations(text: string): string {
  return text.replace(/\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Generate a short, readable executive summary of the contract by
 * combining each agent's top-line conclusion into flowing prose.
 * Deterministic - reuses conclusions already produced by the LLM agents
 * rather than making an additional LLM call.
 */
function generateContractSummary(
  legal: LegalAssessment,
  engineering: EngineeringAssessment,
  accounting: AccountingAssessment,
): string {
  const sentences: string[] = [];

  if (legal.overall_assessment) {
    sentences.push(`Legal: ${stripCitations(String(legal.overall_assessment))}`);
  }

  if (engineering.feasibility) {
    sentences.push(`Engineering: ${stripCitations(String(engineering.feasibility))}`);
  }

  if (accounting.cash_flow_analysis) {
    sentences.push(`Financial: ${stripCitations(String(accounting.cash_flow_analysis))}`);
  }

  if (sentences.length === 0) {
    return 'No summary available - underlying agent assessments did not return enough detail.';
  }

  return sentences.join(' ');
}

/**
 * Generate aggregated summary of all findings
 */
function generateAggregatedFindings(
  legal: LegalAssessment,
  engineering: EngineeringAssessment,
  accounting: AccountingAssessment,
): string {
  const findings: string[] = [];

  findings.push('=== LEGAL ASSESSMENT ===');
  if (legal.overall_assessment) {
    findings.push(`Overall: ${String(legal.overall_assessment).substring(0, 100)}`);
  }
  if (legal.compliance_issues && Array.isArray(legal.compliance_issues) && legal.compliance_issues.length > 0) {
    findings.push(`Key Issues: ${legal.compliance_issues.slice(0, 2).join('; ')}`);
  }

  findings.push('\n=== ENGINEERING ASSESSMENT ===');
  if (engineering.feasibility) {
    findings.push(`Feasibility: ${String(engineering.feasibility).substring(0, 100)}`);
  }
  if (engineering.timeline_estimate) {
    findings.push(`Timeline: ${String(engineering.timeline_estimate).substring(0, 100)}`);
  }

  findings.push('\n=== ACCOUNTING ASSESSMENT ===');
  if (accounting.cash_flow_analysis) {
    findings.push(`Cash Flow: ${String(accounting.cash_flow_analysis).substring(0, 100)}`);
  }
  if (accounting.payment_terms && Array.isArray(accounting.payment_terms) && accounting.payment_terms.length > 0) {
    findings.push(`Key Terms: ${accounting.payment_terms.slice(0, 2).join('; ')}`);
  }

  return findings.join('\n');
}
