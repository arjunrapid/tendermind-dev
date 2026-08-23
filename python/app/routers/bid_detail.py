"""GET/DELETE /api/bid/{id} - ported from app/api/bid/[id]/route.ts.

DELETE removes the bid row and any agent memories learned from that bid's
document, so stale learnings from a deleted document stop being injected
into future analyses.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import db
from app.memory import get_memory_manager

router = APIRouter()


@router.get("/api/bid/{bid_id}")
async def get_bid(bid_id: str):
    try:
        bid = await db.get_bid_by_id(bid_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch bid") from exc

    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    return bid


@router.delete("/api/bid/{bid_id}")
async def delete_bid(bid_id: str):
    try:
        deleted = await db.delete_bid(bid_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete bid") from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Bid not found")

    memories_removed = get_memory_manager().delete_memories_for_bid(bid_id)

    return {"id": bid_id, "deleted": True, "memoriesRemoved": memories_removed}
