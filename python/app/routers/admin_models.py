"""GET/POST /api/admin/models - per-agent LLM provider/model overrides.

Lets an admin pick a specific provider+model for each agent (orchestrator/
legal/engineering/accounting) instead of every agent using the same
environment-wide DEFAULT_LLM_PROVIDER (see agents/nodes.py). An agent with
no saved override keeps using that environment default.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import AdminUser
from app import db
from models.factory import AVAILABLE_MODELS, list_providers

router = APIRouter()

# Agents an override can target - the ones that actually call an LLM.
# `risk` is a deterministic aggregator (agents/risk.py) with no model to pick.
OVERRIDABLE_AGENTS = ("orchestrator", "legal", "engineering", "accounting")


class AgentOverrideIn(BaseModel):
    agent: str
    provider: str | None = None
    model: str | None = None


class SaveModelOverridesRequest(BaseModel):
    overrides: list[AgentOverrideIn]


@router.get("/api/admin/models")
async def get_model_overrides(_admin: AdminUser):
    try:
        saved = await db.get_agent_model_overrides()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch model overrides") from exc

    return {
        "agents": OVERRIDABLE_AGENTS,
        "providers": list_providers(),
        "models_by_provider": AVAILABLE_MODELS,
        "overrides": {
            agent: saved.get(agent, {"provider": None, "model": None})
            for agent in OVERRIDABLE_AGENTS
        },
    }


@router.post("/api/admin/models")
async def save_model_overrides(body: SaveModelOverridesRequest, _admin: AdminUser):
    for entry in body.overrides:
        if entry.agent not in OVERRIDABLE_AGENTS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown agent '{entry.agent}'. Must be one of {OVERRIDABLE_AGENTS}.",
            )
        if entry.provider and entry.provider not in list_providers():
            raise HTTPException(
                status_code=400,
                detail=f"Unknown provider '{entry.provider}'. Must be one of {list_providers()}.",
            )

    overrides = {entry.agent: {"provider": entry.provider, "model": entry.model} for entry in body.overrides}

    try:
        await db.save_agent_model_overrides(overrides)
        saved = await db.get_agent_model_overrides()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to save model overrides") from exc

    return {
        "agents": OVERRIDABLE_AGENTS,
        "providers": list_providers(),
        "models_by_provider": AVAILABLE_MODELS,
        "overrides": {
            agent: saved.get(agent, {"provider": None, "model": None})
            for agent in OVERRIDABLE_AGENTS
        },
    }
