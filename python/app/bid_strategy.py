"""Risk-adjusted bid pricing strategy. Ported from lib/bid-strategy.ts."""

from __future__ import annotations

from typing import Literal

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]

MARGIN_BY_RISK_LEVEL: dict[RiskLevel, float] = {
    "LOW": 0.12,
    "MEDIUM": 0.18,
    "HIGH": 0.25,
}


def _round2(value: float) -> float:
    return round(value * 100) / 100


def calculate_optimal_bid_price(total_project_cost: float, risk_level: RiskLevel) -> dict:
    margin_percentage = MARGIN_BY_RISK_LEVEL.get(risk_level, MARGIN_BY_RISK_LEVEL["MEDIUM"])
    recommended_bid_price = _round2(total_project_cost * (1 + margin_percentage))
    profit_amount = _round2(recommended_bid_price - total_project_cost)

    cost_str = f"{total_project_cost:,.0f}"
    margin_str = f"{margin_percentage * 100:.0f}"

    if risk_level == "LOW":
        rationale = (
            f"Priced at a {margin_str}% margin over the ${cost_str} project cost. "
            "Risk is low, so a tighter margin keeps this bid competitive while remaining solidly profitable."
        )
    elif risk_level == "MEDIUM":
        rationale = (
            f"Priced at a {margin_str}% margin over the ${cost_str} project cost. "
            "The added margin compensates for moderate risk exposure while still leaving room to win the bid."
        )
    else:
        rationale = (
            f"Priced at a {margin_str}% margin over the ${cost_str} project cost. "
            "This is a defensive, walk-away price - risk is high enough that winning at a lower price "
            "would not be worth the exposure."
        )

    return {
        "total_project_cost": total_project_cost,
        "margin_percentage": margin_percentage,
        "recommended_bid_price": recommended_bid_price,
        "profit_amount": profit_amount,
        "rationale": rationale,
    }
