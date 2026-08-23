"""Bill of Quantities defaults and deterministic cost roll-up.
Ported from lib/boq.ts."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

BoqItemType = Literal["measured", "lump_sum"]


class BoqItem(TypedDict):
    key: str
    name: str
    item_type: BoqItemType
    quantity: float | None
    unit: str | None
    unit_rate: float | None
    lump_sum_amount: float | None


DEFAULT_BOQ_ITEMS: list[BoqItem] = [
    {
        "key": "excavation",
        "name": "Excavation",
        "item_type": "measured",
        "quantity": 5000,
        "unit": "cubic yard",
        "unit_rate": 15,
        "lump_sum_amount": None,
    },
    {
        "key": "concrete_foundation",
        "name": "Concrete Foundation",
        "item_type": "measured",
        "quantity": 2000,
        "unit": "cubic foot",
        "unit_rate": 25,
        "lump_sum_amount": None,
    },
    {
        "key": "steel_framing",
        "name": "Steel Framing",
        "item_type": "measured",
        "quantity": 150,
        "unit": "ton",
        "unit_rate": 1200,
        "lump_sum_amount": None,
    },
    {
        "key": "electrical_work",
        "name": "Electrical Work",
        "item_type": "lump_sum",
        "quantity": None,
        "unit": None,
        "unit_rate": None,
        "lump_sum_amount": 50000,
    },
    {
        "key": "mechanical_systems",
        "name": "Mechanical Systems",
        "item_type": "lump_sum",
        "quantity": None,
        "unit": None,
        "unit_rate": None,
        "lump_sum_amount": 45000,
    },
    {
        "key": "finishing",
        "name": "Finishing",
        "item_type": "lump_sum",
        "quantity": None,
        "unit": None,
        "unit_rate": None,
        "lump_sum_amount": 30000,
    },
]

DEFAULT_BOQ_CONTINGENCY_PERCENTAGE = 0.1


def _round2(value: float) -> float:
    return round(value * 100) / 100


def boq_item_amount(item: BoqItem) -> float:
    if item["item_type"] == "lump_sum":
        return item.get("lump_sum_amount") or 0
    return (item.get("quantity") or 0) * (item.get("unit_rate") or 0)


def calculate_boq_costs(
    items: list[BoqItem], contingency_percentage: float = DEFAULT_BOQ_CONTINGENCY_PERCENTAGE
) -> dict[str, Any]:
    with_amounts = [{**item, "amount": _round2(boq_item_amount(item))} for item in items]

    measured_cost = _round2(sum(i["amount"] for i in with_amounts if i["item_type"] == "measured"))
    lump_sum_cost = _round2(sum(i["amount"] for i in with_amounts if i["item_type"] == "lump_sum"))

    base_cost = measured_cost + lump_sum_cost
    contingency_amount = _round2(base_cost * contingency_percentage)
    total_estimated_cost = _round2(base_cost + contingency_amount)

    return {
        "items": with_amounts,
        "measured_cost": measured_cost,
        "lump_sum_cost": lump_sum_cost,
        "contingency_percentage": contingency_percentage,
        "contingency_amount": contingency_amount,
        "total_estimated_cost": total_estimated_cost,
    }
