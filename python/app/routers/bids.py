"""GET /api/bids - ported from app/api/bids/route.ts."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app import db

router = APIRouter()


@router.get("/api/bids")
async def list_bids(limit: int = Query(50), offset: int = Query(0)):
    limit = min(limit, 100)
    try:
        bids = await db.get_bids(limit, offset)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch bids") from exc

    return {"bids": bids, "count": len(bids), "hasMore": len(bids) == limit}
