"""Deterministic EPC pricing calculations. Ported from lib/pricing-engine.ts.
No LLM calls - pure math, contract terms regex-extracted with defaults."""

from __future__ import annotations

import math
import re
from typing import Any

DEFAULT_PRICING_PARAMETERS = {
    "material_cost_percentage": 0.5,
    "labor_cost_percentage": 0.3,
    "contingency_percentage": 0.1,
    "target_margin_percentage": 0.15,
    "ld_rate_per_week_percentage": 0.01,
    "ld_cap_percentage": 0.1,
    "performance_security_percentage": 0.1,
    "retention_rate_per_invoice_percentage": 0.1,
    "retention_cap_percentage": 0.05,
    "invoices_count": 12,
}


def _round2(value: float) -> float:
    return round(value * 100) / 100


def _round4(value: float) -> float:
    return round(value * 10000) / 10000


def calculate_pricing(inputs: dict[str, Any]) -> dict[str, Any]:
    contract_value = inputs["contract_value"]
    estimated_duration_weeks = inputs["estimated_duration_weeks"]
    material_cost_percentage = inputs["material_cost_percentage"]
    labor_cost_percentage = inputs["labor_cost_percentage"]
    contingency_percentage = inputs["contingency_percentage"]
    target_margin_percentage = inputs["target_margin_percentage"]
    ld_rate_per_week_percentage = inputs["ld_rate_per_week_percentage"]
    ld_cap_percentage = inputs["ld_cap_percentage"]
    performance_security_percentage = inputs["performance_security_percentage"]
    retention_rate_per_invoice_percentage = inputs["retention_rate_per_invoice_percentage"]
    retention_cap_percentage = inputs["retention_cap_percentage"]
    invoices_count = inputs["invoices_count"]

    material_cost = _round2(contract_value * material_cost_percentage)
    labor_cost = _round2(contract_value * labor_cost_percentage)
    base_cost = material_cost + labor_cost
    contingency_amount = _round2(base_cost * contingency_percentage)
    total_estimated_cost = _round2(base_cost + contingency_amount)

    recommended_bid_price = _round2(total_estimated_cost * (1 + target_margin_percentage))

    ld_exposure_per_week = _round2(contract_value * ld_rate_per_week_percentage)
    ld_cap_amount = _round2(contract_value * ld_cap_percentage)
    # None (not math.inf) when there's no weekly LD exposure to divide by -
    # math.inf serializes to the bare token `Infinity`, which is invalid
    # JSON and breaks writing this dict to a Postgres JSONB column.
    weeks_to_reach_cap = (
        math.ceil(ld_cap_amount / ld_exposure_per_week) if ld_exposure_per_week > 0 else None
    )

    performance_security_amount = _round2(contract_value * performance_security_percentage)

    raw_invoice_amount = contract_value / invoices_count if invoices_count > 0 else 0
    raw_retention_per_invoice = raw_invoice_amount * retention_rate_per_invoice_percentage
    estimated_invoice_amount = _round2(raw_invoice_amount)
    retention_per_invoice = _round2(raw_retention_per_invoice)
    retention_cap_amount = _round2(contract_value * retention_cap_percentage)
    total_retention_held = min(_round2(raw_retention_per_invoice * invoices_count), retention_cap_amount)

    total_lockup = _round2(performance_security_amount + total_retention_held)
    lockup_as_percentage_of_contract = _round4(total_lockup / contract_value if contract_value > 0 else 0)

    return {
        "contract_value": contract_value,
        "material_cost": material_cost,
        "labor_cost": labor_cost,
        "contingency_amount": contingency_amount,
        "total_estimated_cost": total_estimated_cost,
        "target_margin_percentage": target_margin_percentage,
        "recommended_bid_price": recommended_bid_price,
        "ld_rate_per_week_percentage": ld_rate_per_week_percentage,
        "ld_exposure_per_week": ld_exposure_per_week,
        "ld_cap_percentage": ld_cap_percentage,
        "ld_cap_amount": ld_cap_amount,
        "weeks_to_reach_cap": weeks_to_reach_cap,
        "performance_security_percentage": performance_security_percentage,
        "performance_security_amount": performance_security_amount,
        "estimated_invoice_amount": estimated_invoice_amount,
        "retention_rate_per_invoice_percentage": retention_rate_per_invoice_percentage,
        "retention_per_invoice": retention_per_invoice,
        "retention_cap_percentage": retention_cap_percentage,
        "retention_cap_amount": retention_cap_amount,
        "total_retention_held": total_retention_held,
        "total_lockup": total_lockup,
        "lockup_as_percentage_of_contract": lockup_as_percentage_of_contract,
        "assumptions_used": [],
        "estimated_duration_weeks": estimated_duration_weeks,
    }


def _extract_contract_value(text: str, assumptions_used: list[str]) -> float:
    million_match = re.search(
        r"(?:contract|project)\s*value[:\s]*(?:USD|US\$|\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*million",
        text,
        re.IGNORECASE,
    )
    if million_match:
        return float(million_match.group(1).replace(",", "")) * 1_000_000

    exact_match = re.search(
        r"(?:contract|project)\s*value[:\s]*(?:USD|US\$|\$)?\s*(\d[\d,]*(?:\.\d+)?)", text, re.IGNORECASE
    )
    if exact_match:
        return float(exact_match.group(1).replace(",", ""))

    assumptions_used.append(
        "contract_value: not found in document, defaulted to 0 - caller must supply explicitly"
    )
    return 0


def _extract_duration_weeks(text: str, fallback: int, assumptions_used: list[str]) -> int:
    months_match = re.search(r"duration[:\s]*(\d+)\s*months?", text, re.IGNORECASE)
    if months_match:
        return round(int(months_match.group(1)) * 4.345)

    weeks_match = re.search(r"duration[:\s]*(\d+)\s*weeks?", text, re.IGNORECASE)
    if weeks_match:
        return int(weeks_match.group(1))

    assumptions_used.append(f"estimated_duration_weeks: not found in document, defaulted to {fallback} weeks")
    return fallback


def _extract_percentage(
    text: str, pattern: str, fallback: float, field_name: str, assumptions_used: list[str]
) -> float:
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return float(match.group(1)) / 100

    assumptions_used.append(f"{field_name}: not found in document, defaulted to {fallback * 100:.1f}%")
    return fallback


def extract_pricing_inputs(
    document_text: str, estimated_duration_weeks_fallback: int = 24
) -> tuple[dict[str, Any], list[str]]:
    assumptions_used: list[str] = []

    contract_value = _extract_contract_value(document_text, assumptions_used)
    estimated_duration_weeks = _extract_duration_weeks(
        document_text, estimated_duration_weeks_fallback, assumptions_used
    )

    ld_rate_per_week_percentage = _extract_percentage(
        document_text,
        r"(\d+(?:\.\d+)?)\s*%\s*(?:of\s*(?:the\s*)?contract\s*value\s*)?per\s*week(?:\s*(?:of\s*)?delay)?",
        DEFAULT_PRICING_PARAMETERS["ld_rate_per_week_percentage"],
        "ld_rate_per_week_percentage",
        assumptions_used,
    )
    ld_cap_percentage = _extract_percentage(
        document_text,
        r"(?:liquidated\s*damages|delay\s*penalt(?:y|ies))[\s\S]{0,120}?capped\s*at\s*(\d+(?:\.\d+)?)\s*%",
        DEFAULT_PRICING_PARAMETERS["ld_cap_percentage"],
        "ld_cap_percentage",
        assumptions_used,
    )
    performance_security_percentage = _extract_percentage(
        document_text,
        r"performance\s*(?:bond|security)[:\s]*(?:is\s*)?(\d+(?:\.\d+)?)\s*%",
        DEFAULT_PRICING_PARAMETERS["performance_security_percentage"],
        "performance_security_percentage",
        assumptions_used,
    )
    retention_rate_per_invoice_percentage = _extract_percentage(
        document_text,
        r"retention[:\s]*(?:is\s*)?(\d+(?:\.\d+)?)\s*%",
        DEFAULT_PRICING_PARAMETERS["retention_rate_per_invoice_percentage"],
        "retention_rate_per_invoice_percentage",
        assumptions_used,
    )
    retention_cap_percentage = _extract_percentage(
        document_text,
        r"retention[\s\S]{0,80}?capped\s*at\s*(\d+(?:\.\d+)?)\s*%",
        DEFAULT_PRICING_PARAMETERS["retention_cap_percentage"],
        "retention_cap_percentage",
        assumptions_used,
    )

    inputs = {
        "contract_value": contract_value,
        "estimated_duration_weeks": estimated_duration_weeks,
        "material_cost_percentage": DEFAULT_PRICING_PARAMETERS["material_cost_percentage"],
        "labor_cost_percentage": DEFAULT_PRICING_PARAMETERS["labor_cost_percentage"],
        "contingency_percentage": DEFAULT_PRICING_PARAMETERS["contingency_percentage"],
        "target_margin_percentage": DEFAULT_PRICING_PARAMETERS["target_margin_percentage"],
        "ld_rate_per_week_percentage": ld_rate_per_week_percentage,
        "ld_cap_percentage": ld_cap_percentage,
        "performance_security_percentage": performance_security_percentage,
        "retention_rate_per_invoice_percentage": retention_rate_per_invoice_percentage,
        "retention_cap_percentage": retention_cap_percentage,
        "invoices_count": DEFAULT_PRICING_PARAMETERS["invoices_count"],
    }

    return inputs, assumptions_used


def calculate_pricing_from_document(document_text: str, estimated_duration_weeks_fallback: int = 24) -> dict[str, Any]:
    inputs, assumptions_used = extract_pricing_inputs(document_text, estimated_duration_weeks_fallback)
    breakdown = calculate_pricing(inputs)
    breakdown["assumptions_used"] = assumptions_used
    return breakdown
