"""POST /api/analyze - ported from app/api/analyze/route.ts.

Legal/engineering/accounting run concurrently via the LangGraph pipeline
(graph/pipeline.py); risk aggregation, pricing, and bid-strategy math stay
deterministic (no LLM), matching the original TS pipeline's PRD requirement.
"""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db
from app.bid_strategy import calculate_optimal_bid_price
from app.boq import calculate_boq_costs
from app.classifier import classify_document
from app.knowledge import index_bid_knowledge
from app.pricing_engine import calculate_pricing_from_document
from graph.pipeline import run_pipeline

router = APIRouter()


class AnalyzeRequest(BaseModel):
    fileName: str
    extractedText: str
    documentId: str | None = None
    provider: str | None = None
    model: str | None = None


@router.post("/api/analyze")
async def analyze(body: AnalyzeRequest):
    if not body.fileName or not body.extractedText:
        raise HTTPException(status_code=400, detail="Missing required fields")

    start_time = time.perf_counter()

    classification = classify_document(body.extractedText)

    # Generated up front (rather than left to the DB) so it can be used to
    # tag this document's agent memories and still match the row's primary
    # key later - that's what lets bid deletion find and remove the right
    # memories by the same id.
    bid_id = str(uuid.uuid4())

    try:
        agent_overrides = await db.get_agent_model_overrides()
    except Exception:
        # Model Management is a convenience, not a hard dependency - a
        # lookup failure shouldn't block analysis, just fall back to every
        # agent's environment default (see agents/nodes.py DEFAULT_PROVIDER).
        agent_overrides = {}

    try:
        result = await run_pipeline(
            body.extractedText,
            classification["doc_type"],
            bid_id,
            document_id=body.documentId,
            provider=body.provider,
            model=body.model,
            agent_overrides=agent_overrides,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to analyze document") from exc

    legal_assessment = result["legal"]
    engineering_assessment = result["engineering"]
    accounting_assessment = result["accounting"]
    risk_assessment = result["risk"]
    agent_timings = result.get("agent_timings_ms", {})

    # Deterministic pricing calculation (no LLM - pure math per PRD)
    pricing_breakdown = calculate_pricing_from_document(body.extractedText)

    # Fill in accounting cost figures from the admin-configured BOQ defaults
    # whenever the LLM accounting agent didn't produce its own cost breakdown.
    if accounting_assessment.get("total_estimated_cost") is None:
        boq_items = await db.get_boq_defaults()
        boq_costs = calculate_boq_costs(boq_items)
        accounting_assessment["material_costs"] = boq_costs["measured_cost"]
        accounting_assessment["labor_costs"] = boq_costs["lump_sum_cost"]
        accounting_assessment["contingency_percentage"] = boq_costs["contingency_percentage"] * 100
        accounting_assessment["total_estimated_cost"] = boq_costs["total_estimated_cost"]
        accounting_assessment["boq_breakdown"] = boq_costs["items"]

    # Bid price is derived from the accounting Total Project Cost (not the
    # regex-extracted contract value), with a margin chosen to balance win
    # probability against profitability based on the assessed risk level -
    # only meaningful when the risk agent's bid_decision is YES - when part of
    # the analysis failed (bid_decision == "MANUAL_REVIEW"), a computed price
    # or confidence score would look exactly as trustworthy as a real one, so
    # neither is produced at all; the UI is expected to show a manual-review
    # prompt instead of a suggested bid.
    total_project_cost = float(accounting_assessment.get("total_estimated_cost") or 0)
    needs_manual_review = risk_assessment["bid_decision"] == "MANUAL_REVIEW"

    if needs_manual_review:
        bid_recommendation = {
            "estimated_cost": total_project_cost,
            "bid_margin_percentage": None,
            "recommended_bid_price": None,
            "profit_amount": None,
            "pricing_strategy_rationale": (
                "No bid price suggested - part of the automated analysis failed. "
                "Manual review is required before a price can be recommended."
            ),
            "ld_cap_amount": pricing_breakdown["ld_cap_amount"],
            "performance_security_amount": pricing_breakdown["performance_security_amount"],
            "total_lockup": pricing_breakdown["total_lockup"],
            "risk_level": risk_assessment["risk_level"],
            "recommendation": risk_assessment["recommendation"],
            "recommendation_rationale": risk_assessment["recommendation_rationale"],
            "bid_decision": risk_assessment["bid_decision"],
            "confidence_score": None,
            "agent_timings_ms": agent_timings,
        }
    else:
        bid_strategy = calculate_optimal_bid_price(total_project_cost, risk_assessment["risk_level"])
        bid_recommendation = {
            "estimated_cost": total_project_cost,
            "bid_margin_percentage": bid_strategy["margin_percentage"] * 100,
            "recommended_bid_price": bid_strategy["recommended_bid_price"],
            "profit_amount": bid_strategy["profit_amount"],
            "pricing_strategy_rationale": bid_strategy["rationale"],
            "ld_cap_amount": pricing_breakdown["ld_cap_amount"],
            "performance_security_amount": pricing_breakdown["performance_security_amount"],
            "total_lockup": pricing_breakdown["total_lockup"],
            "risk_level": risk_assessment["risk_level"],
            "recommendation": risk_assessment["recommendation"],
            "recommendation_rationale": risk_assessment["recommendation_rationale"],
            "bid_decision": risk_assessment["bid_decision"],
            "confidence_score": round(
                classification["confidence"] * 0.3 + (1 - risk_assessment["risk_score"]) * 0.7, 2
            ),
            "agent_timings_ms": agent_timings,
        }

    processing_time_ms = int((time.perf_counter() - start_time) * 1000)

    bid = await db.save_bid(
        {
            "id": bid_id,
            "file_name": body.fileName,
            "doc_type": classification["doc_type"],
            "extracted_text": body.extractedText[:5000],
            "classification_confidence": classification["confidence"],
            "legal_assessment": legal_assessment,
            "engineering_assessment": engineering_assessment,
            "accounting_assessment": accounting_assessment,
            "pricing_breakdown": pricing_breakdown,
            "risk_score": risk_assessment["risk_score"],
            "risk_factors": risk_assessment,
            "recommendation": bid_recommendation,
            "llm_provider_used": legal_assessment.get("provider_used", "unknown"),
            "processing_time_ms": processing_time_ms,
        }
    )

    try:
        await index_bid_knowledge(
            bid_id,
            classification["doc_type"],
            legal_assessment=legal_assessment,
            engineering_assessment=engineering_assessment,
            accounting_assessment=accounting_assessment,
            risk_assessment=risk_assessment,
            pricing_breakdown=pricing_breakdown,
        )
    except Exception:
        # Indexing failures must never fail the bid analysis response.
        pass

    return {
        "id": bid["id"],
        "fileName": body.fileName,
        "classification": {
            "doc_type": classification["doc_type"],
            "confidence": classification["confidence"],
        },
        "legalAssessment": legal_assessment,
        "engineeringAssessment": engineering_assessment,
        "accountingAssessment": accounting_assessment,
        "riskAssessment": risk_assessment,
        "pricingBreakdown": pricing_breakdown,
        "bidRecommendation": bid_recommendation,
    }
