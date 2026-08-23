import { NextRequest, NextResponse } from 'next/server';
import { classifyDocument } from '@/lib/classifier';
import { legalAgent } from '@/lib/agents/legal-agent';
import { engineeringAgent } from '@/lib/agents/engineering-agent';
import { accountingAgent } from '@/lib/agents/accounting-agent';
import { riskAgent } from '@/lib/agents/risk-agent';
import { calculatePricingFromDocument } from '@/lib/pricing-engine';
import { saveBid, getBoqDefaults } from '@/lib/db';
import { calculateBoqCosts } from '@/lib/boq';
import { calculateOptimalBidPrice } from '@/lib/bid-strategy';

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const body = await request.json();
    const { fileName, extractedText } = body;

    if (!fileName || !extractedText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Classify document
    const classification = classifyDocument(extractedText);

    // Run the three independent LLM agents concurrently - they don't depend
    // on each other's output, only the Risk Agent (below) needs all three.
    // Each call is timed individually (not just the overall wall clock) so
    // slow/stalled providers are visible per-agent rather than lumped together.
    const timeCall = async <T>(fn: () => Promise<T>) => {
      const start = Date.now();
      const value = await fn();
      return { value, ms: Date.now() - start };
    };

    // Generated up front (rather than left to the DB) so it can be used to
    // tag this document's agent memories below and still match the row's
    // primary key later - that's what lets bid deletion find and remove the
    // right memories by the same id.
    const bidId = crypto.randomUUID();
    const [legalTimed, engineeringTimed, accountingTimed] = await Promise.all([
      timeCall(() => legalAgent(extractedText, bidId, classification.doc_type)),
      timeCall(() => engineeringAgent(extractedText, bidId, classification.doc_type)),
      timeCall(() => accountingAgent(extractedText, bidId, classification.doc_type)),
    ]);
    const legalAssessment = legalTimed.value;
    const engineeringAssessment = engineeringTimed.value;
    const accountingAssessment = accountingTimed.value;

    const riskStart = Date.now();
    const riskAssessment = riskAgent(legalAssessment, engineeringAssessment, accountingAssessment);
    const riskMs = Date.now() - riskStart;

    const agentTimings = {
      legal_ms: legalTimed.ms,
      engineering_ms: engineeringTimed.ms,
      accounting_ms: accountingTimed.ms,
      risk_ms: riskMs,
      // Concurrent agents run in parallel, so wall-clock time is the slowest
      // of the three plus the (fast, synchronous) risk aggregation step.
      agents_wall_clock_ms: Math.max(legalTimed.ms, engineeringTimed.ms, accountingTimed.ms) + riskMs,
    };

    // Deterministic pricing calculation (no LLM - pure math per PRD)
    const pricingBreakdown = calculatePricingFromDocument(extractedText);

    // Fill in accounting cost figures from the admin-configured BOQ defaults
    // whenever the LLM accounting agent didn't produce its own cost breakdown.
    if (accountingAssessment.total_estimated_cost == null) {
      const boqItems = await getBoqDefaults();
      const boqCosts = calculateBoqCosts(boqItems);
      accountingAssessment.material_costs = boqCosts.measured_cost;
      accountingAssessment.labor_costs = boqCosts.lump_sum_cost;
      accountingAssessment.contingency_percentage = boqCosts.contingency_percentage * 100;
      accountingAssessment.total_estimated_cost = boqCosts.total_estimated_cost;
      accountingAssessment.boq_breakdown = boqCosts.items;
    }

    // Bid price is derived from the accounting Total Project Cost (not the
    // regex-extracted contract value), with a margin chosen to balance win
    // probability against profitability based on the assessed risk level -
    // only meaningful when the risk agent's bid_decision is YES.
    const totalProjectCost = Number(accountingAssessment.total_estimated_cost) || 0;
    const bidStrategy = calculateOptimalBidPrice(totalProjectCost, riskAssessment.risk_level);

    // Generate bid recommendation
    const bidRecommendation = {
      estimated_cost: totalProjectCost,
      bid_margin_percentage: bidStrategy.margin_percentage * 100,
      recommended_bid_price: bidStrategy.recommended_bid_price,
      profit_amount: bidStrategy.profit_amount,
      pricing_strategy_rationale: bidStrategy.rationale,
      ld_cap_amount: pricingBreakdown.ld_cap_amount,
      performance_security_amount: pricingBreakdown.performance_security_amount,
      total_lockup: pricingBreakdown.total_lockup,
      risk_level: riskAssessment.risk_level,
      recommendation: riskAssessment.recommendation,
      recommendation_rationale: riskAssessment.recommendation_rationale,
      bid_decision: riskAssessment.bid_decision,
      confidence_score: (
        classification.confidence * 0.3 +
        (1 - riskAssessment.risk_score) * 0.7
      ).toFixed(2),
      agent_timings_ms: agentTimings,
    };

    // Save to database
    const bid = await saveBid({
      id: bidId,
      file_name: fileName,
      doc_type: classification.doc_type,
      extracted_text: extractedText.substring(0, 5000), // Truncate for storage
      classification_confidence: classification.confidence,
      legal_assessment: legalAssessment,
      engineering_assessment: engineeringAssessment,
      accounting_assessment: accountingAssessment,
      pricing_breakdown: pricingBreakdown as unknown as Record<string, unknown>,
      risk_score: riskAssessment.risk_score,
      risk_factors: riskAssessment as unknown as Record<string, unknown>,
      recommendation: bidRecommendation as unknown as Record<string, unknown>,
      llm_provider_used: legalAssessment.provider_used || 'unknown',
      processing_time_ms: Date.now() - startTime,
    });

    return NextResponse.json({
      id: bid.id,
      fileName,
      classification: {
        doc_type: classification.doc_type,
        confidence: classification.confidence,
      },
      legalAssessment,
      engineeringAssessment,
      accountingAssessment,
      riskAssessment,
      pricingBreakdown,
      bidRecommendation,
    });
  } catch (error) {
    console.error('Error analyzing document:', error);
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 },
    );
  }
}
