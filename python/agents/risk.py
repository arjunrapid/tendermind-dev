"""
Deterministic risk aggregator - ported from lib/agents/risk-agent.ts.

Unlike the other three agents, this one makes no LLM call: it's a pure
function of the legal/engineering/accounting outputs, so it runs as the
join node after those three finish (see graph/pipeline.py).
"""

from __future__ import annotations

import re
from typing import Any


def _leading_rating(text: str, candidates: tuple[str, ...]) -> str | None:
    stripped = (text or "").strip()
    for word in candidates:
        if re.match(rf"^{word}\b", stripped, re.IGNORECASE):
            return word.upper()
    return None


def _rating_to_score(rating: str | None) -> float:
    return {"RED": 0.9, "GREEN": 0.15}.get(rating or "", 0.5)


def _feasibility_to_score(rating: str | None) -> float:
    return {"LOW": 0.9, "HIGH": 0.15}.get(rating or "", 0.5)


def _financial_risk_to_score(rating: str | None) -> float:
    return {"HIGH": 0.9, "LOW": 0.15}.get(rating or "", 0.5)


def _counterparty_to_score(verification: dict[str, Any] | None) -> float:
    """Score contribution from agents/nodes.py's counterparty_verification
    (app.counterparty.verify_counterparty via the verify_counterparty tool).
    Absent/unavailable is treated as neutral (0.5), same as an unrated
    financial_risk - no signal either way, not "safe"."""
    if not verification:
        return 0.5
    if verification.get("debarred"):
        return 0.9
    return {"verified": 0.15, "flagged": 0.8, "unavailable": 0.5}.get(verification.get("status") or "", 0.5)


def _risk_level(score: float) -> str:
    if score < 0.33:
        return "LOW"
    if score < 0.67:
        return "MEDIUM"
    return "HIGH"


def _strip_citations(text: str) -> str:
    return re.sub(r"\[[^\]]*\]", "", text or "").strip()


def _extract_legal_risks(legal: dict[str, Any]) -> list[str]:
    risks = [f"Legal - Compliance: {i}" for i in legal.get("compliance_issues", [])]
    risks += [f"Legal - Contract Risk: {i}" for i in legal.get("risks", [])]
    if _leading_rating(legal.get("overall_assessment", ""), ("RED",)):
        risks.append("Legal - Overall assessment rated RED")
    return risks


def _extract_engineering_risks(engineering: dict[str, Any]) -> list[str]:
    risks = [f"Engineering - Structural: {c}" for c in engineering.get("structural_concerns", [])]
    feasibility = engineering.get("feasibility", "")
    if _leading_rating(feasibility, ("LOW", "MEDIUM")):
        risks.append(f"Engineering - Feasibility concern: {feasibility}")
    timeline = engineering.get("timeline_estimate", "").lower()
    if "aggressive" in timeline or "tight" in timeline:
        risks.append(f"Engineering - Timeline pressure: {engineering.get('timeline_estimate', '')}")
    return risks


def _extract_accounting_risks(accounting: dict[str, Any]) -> list[str]:
    risks = []
    for req in accounting.get("qualification_requirements", []):
        if "challenging" in req.lower() or "strict" in req.lower():
            risks.append(f"Accounting - Qualification: {req}")
    for term in accounting.get("payment_terms", []):
        if "retention" in term.lower() or "holdback" in term.lower():
            risks.append(f"Accounting - Payment term: {term}")
    cash_flow = accounting.get("cash_flow_analysis", "").lower()
    if "tight" in cash_flow or "negative" in cash_flow:
        risks.append(f"Accounting - Cash flow concern: {accounting.get('cash_flow_analysis', '')}")
    if _leading_rating(accounting.get("financial_risk", ""), ("HIGH",)):
        risks.append("Accounting - Overall financial risk rated HIGH")

    verification = accounting.get("counterparty_verification")
    if verification:
        entity = verification.get("entity_name") or "the counterparty"
        if verification.get("debarred"):
            risks.append(f"Accounting - Counterparty '{entity}' is debarred/excluded from contracting")
        elif verification.get("status") == "flagged":
            risks.append(
                f"Accounting - Counterparty '{entity}' registry status is "
                f"{verification.get('registration_status', 'unclear')}"
            )
    return risks


def _recommendation(
    legal_risk_count: int, engineering_risk_count: int, risk_level: str, counterparty_debarred: bool = False
) -> str:
    # A debarred/excluded counterparty is disqualifying on its own - an
    # otherwise-pristine legal/engineering read (each just one weighted
    # component of risk_score) must not be able to dilute it back down to
    # PROCEED, so this is checked before, not blended into, risk_level.
    if counterparty_debarred:
        return "DO_NOT_PROCEED"
    if legal_risk_count > 8:
        return "DO_NOT_PROCEED"
    if engineering_risk_count > 7:
        return "DO_NOT_PROCEED"
    if risk_level == "HIGH":
        return "DO_NOT_PROCEED"
    if risk_level == "MEDIUM":
        return "PROCEED_WITH_CAUTION"
    return "PROCEED"


_MITIGATIONS = {
    "legal": [
        "Engage legal counsel to renegotiate high-risk clauses before signing.",
        "Request clarification or amendment on ambiguous compliance requirements.",
        "Secure appropriate insurance coverage for identified liability exposure.",
    ],
    "engineering": [
        "Commission an independent technical review of structural and scope concerns.",
        "Build schedule float into the plan around identified critical-path risks.",
        "Pre-qualify subcontractors/suppliers for specialized scope items early.",
    ],
    "accounting": [
        "Negotiate improved payment terms or reduced retention where possible.",
        "Arrange working-capital financing to bridge identified cash-flow gaps.",
        "Confirm qualification requirements are met before committing to bid.",
    ],
}


def _mitigation_strategies(legal_risks: list[str], eng_risks: list[str], acct_risks: list[str]) -> list[str]:
    strategies: list[str] = []
    if legal_risks:
        strategies += _MITIGATIONS["legal"]
    if eng_risks:
        strategies += _MITIGATIONS["engineering"]
    if acct_risks:
        strategies += _MITIGATIONS["accounting"]
    return strategies[:6]


def _rationale(
    legal_rating: str | None,
    feasibility_rating: str | None,
    financial_rating: str | None,
    risk_level: str,
    recommendation: str,
) -> str:
    parts = []
    parts.append(
        {
            "RED": "Legal review flagged significant contractual risk.",
            "GREEN": "Legal review found the contract acceptable as-is or with minor changes.",
        }.get(legal_rating or "", "Legal review found terms requiring negotiation.")
    )
    parts.append(
        {
            "LOW": "Engineering feasibility is a serious concern.",
            "HIGH": "Engineering feasibility looks strong.",
        }.get(feasibility_rating or "", "Engineering feasibility is moderate, with some concerns to manage.")
    )
    parts.append(
        {
            "HIGH": "Financial risk is a serious concern.",
            "LOW": "Financial risk looks low.",
        }.get(financial_rating or "", "Financial risk is moderate, with some terms to negotiate.")
    )
    parts.append(
        {
            "DO_NOT_PROCEED": "Combined risk is high enough that bidding is not recommended without major changes.",
            "PROCEED_WITH_CAUTION": "Combined risk is moderate; proceed only with active mitigation of the risks above.",
        }.get(recommendation, "Combined risk is low; proceeding with this bid is reasonable.")
    )
    return " ".join(parts)


def _contract_summary(legal: dict[str, Any], engineering: dict[str, Any], accounting: dict[str, Any]) -> str:
    parts = [
        _strip_citations(legal.get("overall_assessment", "")),
        _strip_citations(engineering.get("feasibility", "")),
        _strip_citations(accounting.get("cash_flow_analysis", "")),
    ]
    return " ".join(p for p in parts if p)


def _aggregated_findings(legal: dict[str, Any], engineering: dict[str, Any], accounting: dict[str, Any]) -> str:
    def _trim(items: list[str], n: int = 2) -> str:
        return "; ".join(i[:100] for i in items[:n])

    return (
        "=== LEGAL ASSESSMENT ===\n"
        f"Compliance: {_trim(legal.get('compliance_issues', []))}\n"
        f"Risks: {_trim(legal.get('risks', []))}\n"
        f"Overall: {legal.get('overall_assessment', '')[:100]}\n\n"
        "=== ENGINEERING ASSESSMENT ===\n"
        f"Concerns: {_trim(engineering.get('structural_concerns', []))}\n"
        f"Feasibility: {engineering.get('feasibility', '')[:100]}\n"
        f"Timeline: {engineering.get('timeline_estimate', '')[:100]}\n\n"
        "=== ACCOUNTING ASSESSMENT ===\n"
        f"Costs: {_trim(accounting.get('cost_analysis', []))}\n"
        f"Payment terms: {_trim(accounting.get('payment_terms', []))}\n"
        f"Cash flow: {accounting.get('cash_flow_analysis', '')[:100]}"
    )


def _failed_agents(legal: dict[str, Any], engineering: dict[str, Any], accounting: dict[str, Any]) -> list[str]:
    """An agent's node in graph/pipeline.py catches its own exceptions and
    returns a placeholder result tagged `provider_used: "error"` rather than
    raising - so a failure never shows up as a Python exception here, it has
    to be detected from this marker instead."""
    failed = []
    if legal.get("provider_used") == "error":
        failed.append("legal")
    if engineering.get("provider_used") == "error":
        failed.append("engineering")
    if accounting.get("provider_used") == "error":
        failed.append("accounting")
    return failed


def _manual_review_result(failed_agents: list[str]) -> dict[str, Any]:
    """A partial (some agents failed) analysis is worse than no analysis: a
    risk score/bid price computed from 1-2 working agents looks exactly as
    confident as one computed from all three, so a downstream reader can't
    tell it's degraded. Surface the failure as a decision in its own right
    instead of silently averaging over it."""
    agents_str = ", ".join(failed_agents)
    return {
        "risk_score": None,
        "risk_level": "UNKNOWN",
        "risk_factors": [f"{agent.capitalize()} agent analysis failed - automated result unavailable" for agent in failed_agents],
        "mitigation_strategies": [
            "Have a qualified reviewer manually assess this document before making a bid decision.",
            "Re-run automated analysis once the underlying issue is resolved (check LLM provider/API key configuration and logs).",
        ],
        "recommendation": "MANUAL_REVIEW_REQUIRED",
        "recommendation_rationale": (
            f"Automated analysis failed for: {agents_str}. No bid recommendation can be made from an "
            "incomplete assessment - this document requires manual review before any bid decision."
        ),
        "aggregated_findings": f"Analysis incomplete - {agents_str} agent(s) failed. Manual review required.",
        "contract_summary": "Unable to generate a reliable summary - part of the automated analysis failed. Manual review required.",
        "bid_decision": "MANUAL_REVIEW",
    }


def risk_agent(legal: dict[str, Any], engineering: dict[str, Any], accounting: dict[str, Any]) -> dict[str, Any]:
    failed_agents = _failed_agents(legal, engineering, accounting)
    if failed_agents:
        return _manual_review_result(failed_agents)

    try:
        legal_risks = _extract_legal_risks(legal)
        engineering_risks = _extract_engineering_risks(engineering)
        accounting_risks = _extract_accounting_risks(accounting)

        legal_rating = _leading_rating(legal.get("overall_assessment", ""), ("GREEN", "YELLOW", "RED"))
        feasibility_rating = _leading_rating(engineering.get("feasibility", ""), ("HIGH", "MEDIUM", "LOW"))
        financial_rating = _leading_rating(accounting.get("financial_risk", ""), ("HIGH", "MEDIUM", "LOW"))

        # A debarred/excluded counterparty is a hard stop regardless of what
        # the LLM otherwise concluded about financial_risk, and regardless of
        # how favorable the legal/engineering read is - this can't be a soft
        # blend into risk_score (accounting is only 25% of that weighted
        # sum, so even a maxed-out accounting_component can't reliably carry
        # it to HIGH on its own). See _extract_accounting_risks for where
        # this also becomes a listed risk factor, and _recommendation for
        # the resulting DO_NOT_PROCEED override.
        counterparty_debarred = bool((accounting.get("counterparty_verification") or {}).get("debarred"))
        if counterparty_debarred:
            financial_rating = "HIGH"

        counterparty_score = _counterparty_to_score(accounting.get("counterparty_verification"))

        legal_component = _rating_to_score(legal_rating) * 0.65 + min(len(legal_risks) / 12, 1) * 0.35
        engineering_component = _feasibility_to_score(feasibility_rating) * 0.65 + min(len(engineering_risks) / 10, 1) * 0.35
        accounting_component = (
            _financial_risk_to_score(financial_rating) * 0.5
            + min(len(accounting_risks) / 10, 1) * 0.3
            + counterparty_score * 0.2
        )

        risk_score = legal_component * 0.4 + engineering_component * 0.35 + accounting_component * 0.25
        risk_level = "HIGH" if counterparty_debarred else _risk_level(risk_score)
        recommendation = _recommendation(len(legal_risks), len(engineering_risks), risk_level, counterparty_debarred)
        bid_decision = "NO" if recommendation == "DO_NOT_PROCEED" else "YES"

        return {
            "risk_score": round(risk_score, 3),
            "risk_level": risk_level,
            "risk_factors": legal_risks + engineering_risks + accounting_risks,
            "mitigation_strategies": _mitigation_strategies(legal_risks, engineering_risks, accounting_risks),
            "recommendation": recommendation,
            "recommendation_rationale": _rationale(
                legal_rating, feasibility_rating, financial_rating, risk_level, recommendation
            ),
            "aggregated_findings": _aggregated_findings(legal, engineering, accounting),
            "contract_summary": _contract_summary(legal, engineering, accounting),
            "bid_decision": bid_decision,
        }
    except Exception:
        return _manual_review_result(["risk aggregation"])
