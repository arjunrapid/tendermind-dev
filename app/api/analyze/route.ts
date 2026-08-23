import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { classifyDocument } from '@/lib/classifier';
import { legalAgent } from '@/lib/agents/legal-agent';
import { engineeringAgent } from '@/lib/agents/engineering-agent';
import { accountingAgent } from '@/lib/agents/accounting-agent';
import { riskAgent } from '@/lib/agents/risk-agent';
import { calculatePricingFromDocument } from '@/lib/pricing-engine';
import { calculateOptimalBidPrice, RiskLevel } from '@/lib/bid-strategy';
import { calculateBoqCosts } from '@/lib/boq';
import { getBoqDefaults, saveBid } from '@/lib/db';

/**
 * Analysis endpoint with two backends:
 *
 * 1. When PYTHON_BACKEND_URL is set, proxies to the Python/FastAPI backend
 *    (python/app/routers/analyze.py) - that pipeline carries LangGraph +
 *    LangSmith tracing and pgvector-backed company-knowledge retrieval.
 * 2. Otherwise (or when the Python backend is unreachable), runs the
 *    TypeScript agent pipeline (lib/agents/*.ts) directly in this function.
 *    The Python route is a port of this pipeline, so both produce the same
 *    response shape (fileName, classification, legalAssessment,
 *    engineeringAssessment, accountingAssessment, riskAssessment,
 *    pricingBreakdown, bidRecommendation, id). The TS path skips only the
 *    pgvector knowledge indexing, which exists in the Python stack alone.
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;

// Three LLM agents run in parallel; each can take up to its own timeout.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let body: { fileName?: string; extractedText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { fileName, extractedText } = body;
  if (!fileName || !extractedText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (PYTHON_BACKEND_URL) {
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: data.detail || 'Failed to analyze document' },
          { status: response.status },
        );
      }

      return NextResponse.json(data);
    } catch (error) {
      // Backend configured but unreachable - fall through to the TS pipeline
      // rather than failing the analysis outright.
      console.error('Python analyze backend unreachable, falling back to TS pipeline:', error);
    }
  }

  try {
    const startTime = Date.now();

    const classification = classifyDocument(extractedText);

    // Generated up front (rather than left to the DB) so it can be used to
    // tag this document's agent memories and still match the row's primary
    // key later - that's what lets bid deletion find and remove the right
    // memories by the same id.
    const bidId = randomUUID();

    const agentsStart = Date.now();
    const [legal, engineering, accounting] = await Promise.all([
      legalAgent(extractedText, bidId, classification.doc_type),
      engineeringAgent(extractedText, bidId, classification.doc_type),
      accountingAgent(extractedText, bidId, classification.doc_type),
    ]);
    const agentsWallClockMs = Date.now() - agentsStart;

    const risk = riskAgent(legal, engineering, accounting);
    const pricingBreakdown = calculatePricingFromDocument(extractedText);

    // Fill in accounting cost figures from the admin-configured BOQ defaults
    // whenever the LLM accounting agent didn't produce its own cost breakdown.
    if (accounting.total_estimated_cost == null) {
      try {
        const boqCosts = calculateBoqCosts(await getBoqDefaults());
        accounting.material_costs = boqCosts.measured_cost;
        accounting.labor_costs = boqCosts.lump_sum_cost;
        accounting.contingency_percentage = boqCosts.contingency_percentage * 100;
        accounting.total_estimated_cost = boqCosts.total_estimated_cost;
        accounting.boq_breakdown = boqCosts.items;
      } catch (boqError) {
        // BOQ defaults are a convenience, not a hard dependency - a DB miss
        // must not fail the analysis.
        console.error('BOQ defaults unavailable, continuing without cost fill-in:', boqError);
      }
    }

    // Bid price derives from the accounting Total Project Cost with a
    // risk-adjusted margin - only meaningful when bid_decision is YES. When
    // part of the analysis failed (MANUAL_REVIEW), a computed price or
    // confidence score would look exactly as trustworthy as a real one, so
    // neither is produced at all.
    const totalProjectCost = Number(accounting.total_estimated_cost || 0);
    const needsManualReview = risk.bid_decision === 'MANUAL_REVIEW';

    const agentTimings = { agents_wall_clock_ms: agentsWallClockMs };

    let bidRecommendation: Record<string, unknown>;
    if (needsManualReview) {
      bidRecommendation = {
        estimated_cost: totalProjectCost,
        bid_margin_percentage: null,
        recommended_bid_price: null,
        profit_amount: null,
        pricing_strategy_rationale:
          'No bid price suggested - part of the automated analysis failed. ' +
          'Manual review is required before a price can be recommended.',
        ld_cap_amount: pricingBreakdown.ld_cap_amount,
        performance_security_amount: pricingBreakdown.performance_security_amount,
        total_lockup: pricingBreakdown.total_lockup,
        risk_level: risk.risk_level,
        recommendation: risk.recommendation,
        recommendation_rationale: risk.recommendation_rationale,
        bid_decision: risk.bid_decision,
        confidence_score: null,
        agent_timings_ms: agentTimings,
      };
    } else {
      const bidStrategy = calculateOptimalBidPrice(
        totalProjectCost,
        risk.risk_level as RiskLevel,
      );
      bidRecommendation = {
        estimated_cost: totalProjectCost,
        bid_margin_percentage: bidStrategy.margin_percentage * 100,
        recommended_bid_price: bidStrategy.recommended_bid_price,
        profit_amount: bidStrategy.profit_amount,
        pricing_strategy_rationale: bidStrategy.rationale,
        ld_cap_amount: pricingBreakdown.ld_cap_amount,
        performance_security_amount: pricingBreakdown.performance_security_amount,
        total_lockup: pricingBreakdown.total_lockup,
        risk_level: risk.risk_level,
        recommendation: risk.recommendation,
        recommendation_rationale: risk.recommendation_rationale,
        bid_decision: risk.bid_decision,
        confidence_score:
          Math.round(
            (classification.confidence * 0.3 + (1 - (risk.risk_score ?? 0)) * 0.7) * 100,
          ) / 100,
        agent_timings_ms: agentTimings,
      };
    }

    const processingTimeMs = Date.now() - startTime;

    try {
      await saveBid({
        id: bidId,
        file_name: fileName,
        doc_type: classification.doc_type,
        extracted_text: extractedText.slice(0, 5000),
        classification_confidence: classification.confidence,
        legal_assessment: legal,
        engineering_assessment: engineering,
        accounting_assessment: accounting,
        pricing_breakdown: pricingBreakdown as unknown as Record<string, unknown>,
        risk_score: risk.risk_score as unknown as number,
        risk_factors: risk as unknown as Record<string, unknown>,
        recommendation: bidRecommendation,
        llm_provider_used: (legal.provider_used as string) || 'unknown',
        processing_time_ms: processingTimeMs,
      });
    } catch (dbError) {
      // Persisting is best-effort: the user should still see their analysis
      // even if the history row could not be written.
      console.error('Failed to save bid, returning analysis anyway:', dbError);
    }

    return NextResponse.json({
      id: bidId,
      fileName,
      classification: {
        doc_type: classification.doc_type,
        confidence: classification.confidence,
      },
      legalAssessment: legal,
      engineeringAssessment: engineering,
      accountingAssessment: accounting,
      riskAssessment: risk,
      pricingBreakdown,
      bidRecommendation,
    });
  } catch (error) {
    console.error('Error running TS analysis pipeline:', error);
    return NextResponse.json({ error: 'Failed to analyze document' }, { status: 500 });
  }
}
