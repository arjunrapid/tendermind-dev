"""GET/POST /api/admin/boq - ported from app/api/admin/boq/route.ts."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db
from app.boq import DEFAULT_BOQ_CONTINGENCY_PERCENTAGE, BoqItem, calculate_boq_costs

router = APIRouter()


class BoqItemIn(BaseModel):
    key: str
    name: str
    item_type: str
    quantity: float | None = None
    unit: str | None = None
    unit_rate: float | None = None
    lump_sum_amount: float | None = None


class SaveBoqRequest(BaseModel):
    items: list[BoqItemIn]


@router.get("/api/admin/boq")
async def get_boq_defaults():
    try:
        items = await db.get_boq_defaults()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch BOQ defaults") from exc

    summary = calculate_boq_costs(items, DEFAULT_BOQ_CONTINGENCY_PERCENTAGE)
    return {"items": items, "summary": summary}


@router.post("/api/admin/boq")
async def save_boq_defaults(body: SaveBoqRequest):
    if not body.items:
        raise HTTPException(status_code=400, detail="items must be a non-empty array")

    items: list[BoqItem] = [item.model_dump() for item in body.items]
    for item in items:
        if not item.get("key") or not item.get("name") or not item.get("item_type"):
            raise HTTPException(status_code=400, detail="Each item requires key, name, and item_type")

    try:
        await db.save_boq_defaults(items)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to save BOQ defaults") from exc

    summary = calculate_boq_costs(items, DEFAULT_BOQ_CONTINGENCY_PERCENTAGE)
    return {"items": items, "summary": summary}
