"""Unit tests for app.validation - pre-persist bid result checks."""

import pytest
from app.validation import validate_bid_result


def _base_legal():
    return {
        "overall_assessment": "GREEN: Acceptable",
        "compliance_issues": ["Issue [page:1]"],
        "contract_terms": [],
        "risks": [],
        "provider_used": "anthropic",
    }


def _base_engineering():
    return {
        "feasibility": "HIGH",
        "structural_concerns": [],
        "scope_analysis": [],
        "site_requirements": [],
        "provider_used": "anthropic",
    }


def _base_accounting():
    return {
        "cash_flow_analysis": "Positive cash flow expected.",
        "cost_analysis": [],
        "payment_terms": [],
        "qualification_requirements": [],
        "provider_used": "anthropic",
    }


def _base_risk(decision="YES"):
    return {
        "risk_level": "LOW",
        "risk_score": 0.2,
        "bid_decision": decision,
        "recommendation": "PROCEED",
        "recommendation_rationale": "Low risk.",
        "risk_factors": [],
        "mitigation_strategies": [],
    }


def _base_rec():
    return {
        "bid_decision": "YES",
        "estimated_cost": 1_000_000,
        "recommended_bid_price": 1_100_000,
        "confidence_score": 0.8,
    }


def _base_pricing():
    return {"ld_cap_amount": 50_000, "performance_security_amount": 50_000, "total_lockup": 100_000}


def test_valid_bid():
    report = validate_bid_result(
        _base_legal(), _base_engineering(), _base_accounting(),
        _base_risk(), _base_rec(), _base_pricing()
    )
    assert report["is_valid"]
    assert report["errors"] == []


def test_invalid_risk_level():
    risk = _base_risk()
    risk["risk_level"] = "EXTREME"
    report = validate_bid_result(
        _base_legal(), _base_engineering(), _base_accounting(),
        risk, _base_rec(), _base_pricing()
    )
    codes = [e["code"] for e in report["errors"]]
    assert "INVALID_RISK_LEVEL" in codes


def test_high_risk_with_yes_decision():
    risk = _base_risk("YES")
    risk["risk_score"] = 0.9
    risk["risk_level"] = "HIGH"
    rec = _base_rec()
    rec["bid_decision"] = "YES"
    report = validate_bid_result(
        _base_legal(), _base_engineering(), _base_accounting(),
        risk, rec, _base_pricing()
    )
    codes = [e["code"] for e in report["errors"]]
    assert "BID_DECISION_INCONSISTENT_WITH_HIGH_RISK" in codes


def test_bid_price_below_cost_warning():
    rec = _base_rec()
    rec["recommended_bid_price"] = 900_000  # below estimated_cost 1_000_000
    report = validate_bid_result(
        _base_legal(), _base_engineering(), _base_accounting(),
        _base_risk(), rec, _base_pricing()
    )
    codes = [w["code"] for w in report["warnings"]]
    assert "BID_PRICE_BELOW_COST" in codes


def test_missing_legal_assessment_warning():
    legal = _base_legal()
    legal["overall_assessment"] = ""
    report = validate_bid_result(
        legal, _base_engineering(), _base_accounting(),
        _base_risk(), _base_rec(), _base_pricing()
    )
    codes = [w["code"] for w in report["warnings"]]
    assert "MISSING_LEGAL_ASSESSMENT" in codes
