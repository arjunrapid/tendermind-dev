"""
LangGraph pipeline that runs legal/engineering/accounting in parallel and
joins them into the deterministic risk aggregator.

Fan-out is structural, not manual: START has an edge to each of the three
agent nodes, so LangGraph schedules them in the same superstep (concurrent
`ainvoke` calls under the hood). `risk` has incoming edges from all three,
so the graph runner blocks it until every one of them has written its state
key - i.e. a real join, not a race.
"""

from __future__ import annotations

import time
from typing import Annotated, Any, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.nodes import accounting_agent, engineering_agent, legal_agent
from agents.orchestrator import route_document_content
from agents.risk import risk_agent


def _merge_dicts(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    """Reducer for `agent_timings_ms`: legal/engineering/accounting all write
    to this key in the same parallel superstep, so LangGraph needs a merge
    function instead of last-write-wins (which would raise on concurrent
    writes to the same key)."""
    return {**(left or {}), **(right or {})}


class BidAnalysisState(TypedDict, total=False):
    bid_id: str
    doc_type: str
    document_text: Optional[str]
    document_id: Optional[str]
    provider: Optional[str]
    model: Optional[str]
    agent_overrides: dict[str, dict[str, Optional[str]]]
    legal: dict[str, Any]
    engineering: dict[str, Any]
    accounting: dict[str, Any]
    risk: dict[str, Any]
    routed_content: dict[str, str]
    agent_timings_ms: Annotated[dict[str, float], _merge_dicts]


def _resolve_model(state: BidAnalysisState, agent: str) -> tuple[Optional[str], Optional[str]]:
    """Provider/model for one agent, in priority order:
    1. `provider`/`model` on the request itself - an explicit, one-off
       override for this analysis, applied to every agent (e.g. a test call
       forcing everything onto one provider).
    2. This agent's saved override from the Model Management screen
       (`agent_overrides`, populated from `agent_model_overrides` via
       app/routers/admin_models.py).
    3. Neither - the agent falls back to DEFAULT_LLM_PROVIDER (see
       agents/nodes.py) itself."""
    if state.get("provider") or state.get("model"):
        return state.get("provider"), state.get("model")
    override = state.get("agent_overrides", {}).get(agent, {})
    return override.get("provider"), override.get("model")


async def _orchestrator_node(state: BidAnalysisState) -> dict[str, Any]:
    """Runs once, before the fan-out: reads the whole document and splits it
    into per-domain excerpts (agents/orchestrator.py) so legal/engineering/
    accounting each only ever see their own slice, not the full document."""
    start = time.perf_counter()
    provider, model = _resolve_model(state, "orchestrator")
    routed = await route_document_content(
        state.get("document_text"),
        state["doc_type"],
        state["bid_id"],
        provider=provider,
        model=model,
    )
    return {
        "routed_content": routed,
        "agent_timings_ms": {"orchestrator_ms": (time.perf_counter() - start) * 1000},
    }


async def _legal_node(state: BidAnalysisState) -> dict[str, Any]:
    start = time.perf_counter()
    provider, model = _resolve_model(state, "legal")
    result = await legal_agent(
        state.get("document_text"),
        state["bid_id"],
        state["doc_type"],
        document_id=state.get("document_id"),
        provider=provider,
        model=model,
        routed_text=state.get("routed_content", {}).get("legal"),
    )
    return {"legal": result, "agent_timings_ms": {"legal_ms": (time.perf_counter() - start) * 1000}}


async def _engineering_node(state: BidAnalysisState) -> dict[str, Any]:
    start = time.perf_counter()
    provider, model = _resolve_model(state, "engineering")
    result = await engineering_agent(
        state.get("document_text"),
        state["bid_id"],
        state["doc_type"],
        document_id=state.get("document_id"),
        provider=provider,
        model=model,
        routed_text=state.get("routed_content", {}).get("engineering"),
    )
    return {
        "engineering": result,
        "agent_timings_ms": {"engineering_ms": (time.perf_counter() - start) * 1000},
    }


async def _accounting_node(state: BidAnalysisState) -> dict[str, Any]:
    start = time.perf_counter()
    provider, model = _resolve_model(state, "accounting")
    result = await accounting_agent(
        state.get("document_text"),
        state["bid_id"],
        state["doc_type"],
        document_id=state.get("document_id"),
        provider=provider,
        model=model,
        routed_text=state.get("routed_content", {}).get("accounting"),
    )
    return {
        "accounting": result,
        "agent_timings_ms": {"accounting_ms": (time.perf_counter() - start) * 1000},
    }


def _risk_node(state: BidAnalysisState) -> dict[str, Any]:
    start = time.perf_counter()
    result = risk_agent(state["legal"], state["engineering"], state["accounting"])
    risk_ms = (time.perf_counter() - start) * 1000
    timings = dict(state.get("agent_timings_ms", {}))
    timings["risk_ms"] = risk_ms
    timings["agents_wall_clock_ms"] = (
        max(timings.get("legal_ms", 0), timings.get("engineering_ms", 0), timings.get("accounting_ms", 0))
        + risk_ms
        + timings.get("orchestrator_ms", 0)
    )
    return {"risk": result, "agent_timings_ms": timings}


def build_pipeline():
    graph = StateGraph(BidAnalysisState)

    graph.add_node("orchestrator", _orchestrator_node)
    graph.add_node("legal", _legal_node)
    graph.add_node("engineering", _engineering_node)
    graph.add_node("accounting", _accounting_node)
    graph.add_node("risk", _risk_node)

    # Orchestrator runs first and alone: it reads the whole document and
    # routes per-domain excerpts into state before any domain agent starts,
    # so the fan-out below no longer hands the full document to all three.
    graph.add_edge(START, "orchestrator")

    # Fan-out: all three start together, independently, in parallel, once
    # routing is done.
    graph.add_edge("orchestrator", "legal")
    graph.add_edge("orchestrator", "engineering")
    graph.add_edge("orchestrator", "accounting")

    # Join: risk waits for all three before running.
    graph.add_edge("legal", "risk")
    graph.add_edge("engineering", "risk")
    graph.add_edge("accounting", "risk")

    graph.add_edge("risk", END)

    return graph.compile()


async def run_pipeline(
    document_text: str | None,
    doc_type: str,
    bid_id: str,
    *,
    document_id: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    agent_overrides: dict[str, dict[str, str | None]] | None = None,
) -> BidAnalysisState:
    """`document_id` (from the upload's stored document) is preferred when
    present - agents call `extract_document_text` themselves instead of the
    text being pasted into their prompt. `document_text` is a fallback for
    callers with no document store (e.g. the standalone CLI).

    `agent_overrides` (from the Model Management screen, app/routers/
    admin_models.py) lets each agent use its own provider/model instead of
    all four sharing `provider`/`model` - see `_resolve_model` above for the
    precedence between the two."""
    pipeline = build_pipeline()
    return await pipeline.ainvoke(
        {
            "bid_id": bid_id,
            "doc_type": doc_type,
            "document_text": document_text,
            "document_id": document_id,
            "provider": provider,
            "model": model,
            "agent_overrides": agent_overrides or {},
        }
    )
