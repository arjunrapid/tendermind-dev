"""Pre-persist validation for bid analysis results.

Runs deterministic checks on the assembled bid before it is written to the
database.  A validation failure does *not* block the save - a bad or
incomplete analysis is still worth persisting for audit - but the failures
are logged, annotated onto the result, and (for critical errors) elevate the
bid to MANUAL_REVIEW so the risk decision is never silently wrong.

Design principle: every check here must be provably correct (no LLM
reasoning).  Subjective quality checks belong in the citation enforcer or
the risk agent.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Risk levels and bid decisions we actually produce.
_VALID_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH", "UNKNOWN"}
_VALID_BID_DECISIONS = {"YES", "NO", "MANUAL_REVIEW"}
_VALID_RECOMMENDATIONS = {"PROCEED", "PROCEED_WITH_CAUTION", "DO_NOT_PROCEED", "MANUAL_REVIEW_REQUIRED"}


def _check(condition: bool, code: str, message: str) -> dict[str, str] | None:
    return {"code": code, "message": message} if not condition else None


def validate_bid_result(
    legal: dict[str, Any],
    engineering: dict[str, Any],
    accounting: dict[str, Any],
    risk: dict[str, Any],
    bid_recommendation: dict[str, Any],
    pricing_breakdown: dict[str, Any],
) -> dict[str, Any]:
    """Run all validation checks and return a structured report.

    Returns::

        {
            "errors": [...],    # critical - elevate to MANUAL_REVIEW
            "warnings": [...],  # non-critical - annotate only
            "is_valid": bool,   # True when errors is empty
        }
    """
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    def e(condition: bool, code: str, msg: str) -> None:
        """Add an error when the validation condition is False (check failed)."""
        if not condition:
            errors.append({"code": code, "message": msg})

    def w(condition: bool, code: str, msg: str) -> None:
        """Add a warning when the validation condition is False (check failed)."""
        if not condition:
            warnings.append({"code": code, "message": msg})

    # --- Required fields in risk assessment ----------------------------------
    e(
        "risk_level" in risk and risk["risk_level"] in _VALID_RISK_LEVELS,
        "INVALID_RISK_LEVEL",
        f"risk_level must be one of {_VALID_RISK_LEVELS}, got: {risk.get('risk_level')!r}",
    )
    e(
        "bid_decision" in risk and risk["bid_decision"] in _VALID_BID_DECISIONS,
        "INVALID_BID_DECISION",
        f"bid_decision must be one of {_VALID_BID_DECISIONS}, got: {risk.get('bid_decision')!r}",
    )
    e(
        "recommendation" in risk and risk["recommendation"] in _VALID_RECOMMENDATIONS,
        "INVALID_RECOMMENDATION",
        f"recommendation must be one of {_VALID_RECOMMENDATIONS}, got: {risk.get('recommendation')!r}",
    )

    # --- Risk score coherence ------------------------------------------------
    risk_score = risk.get("risk_score")
    if risk_score is not None:
        e(
            isinstance(risk_score, (int, float)) and 0.0 <= risk_score <= 1.0,
            "RISK_SCORE_OUT_OF_RANGE",
            f"risk_score must be in [0, 1], got: {risk_score!r}",
        )
        # If risk_score is high (>= 0.67) the decision should not be YES.
        if isinstance(risk_score, (int, float)) and risk_score >= 0.67:
            e(
                bid_recommendation.get("bid_decision") != "YES",
                "BID_DECISION_INCONSISTENT_WITH_HIGH_RISK",
                f"bid_decision=YES is inconsistent with high risk_score={risk_score:.2f}",
            )

    # --- Required agent fields -----------------------------------------------
    w(
        bool(legal.get("overall_assessment")),
        "MISSING_LEGAL_ASSESSMENT",
        "Legal agent did not produce an overall_assessment",
    )
    w(
        bool(engineering.get("feasibility")),
        "MISSING_ENGINEERING_FEASIBILITY",
        "Engineering agent did not produce a feasibility rating",
    )
    w(
        bool(accounting.get("cash_flow_analysis")),
        "MISSING_ACCOUNTING_CASH_FLOW",
        "Accounting agent did not produce a cash_flow_analysis",
    )

    # --- Pricing coherence ---------------------------------------------------
    if bid_recommendation.get("bid_decision") == "YES":
        rec_price = bid_recommendation.get("recommended_bid_price")
        est_cost = bid_recommendation.get("estimated_cost")
        w(
            rec_price is not None and isinstance(rec_price, (int, float)) and rec_price > 0,
            "MISSING_BID_PRICE_FOR_YES_DECISION",
            "bid_decision=YES but recommended_bid_price is absent or zero",
        )
        if rec_price and est_cost:
            w(
                rec_price >= est_cost,
                "BID_PRICE_BELOW_COST",
                f"recommended_bid_price ({rec_price:.0f}) is below estimated_cost ({est_cost:.0f})",
            )

    if errors:
        logger.warning(
            "Bid validation errors (%d): %s",
            len(errors),
            [e["code"] for e in errors],
        )
    if warnings:
        logger.info(
            "Bid validation warnings (%d): %s",
            len(warnings),
            [w["code"] for w in warnings],
        )

    return {
        "errors": errors,
        "warnings": warnings,
        "is_valid": len(errors) == 0,
    }
