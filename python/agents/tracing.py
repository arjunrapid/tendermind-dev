"""
LangSmith tracing setup.

LangChain/LangGraph auto-trace to LangSmith purely from environment
variables (`LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY`) - no code
change needed for a run to show up. This module just:

1. Validates that tracing is actually configured (so a missing API key
   fails loudly at startup instead of "no traces? huh." later), and
2. Gives every agent a consistent `run_name`/`tags`/`metadata` shape so a
   run in the LangSmith UI can be found by agent/bid_id/doc_type instead of
   scrolling through an undifferentiated trace list.

Every model call inside a deep agent's run (including tool calls) is
captured as its own child trace under the parent run this module names -
that's what shows the exact messages (system prompt + user message + any
tool results) each agent received, not just its final answer.
"""

from __future__ import annotations

import os


def tracing_enabled() -> bool:
    return os.environ.get("LANGCHAIN_TRACING_V2", "").lower() == "true"


def configure_tracing() -> None:
    """Call once at process startup (see app/main.py's lifespan and
    run_analysis.py's main). Logs whether tracing is on, and warns if it
    was requested but misconfigured, rather than failing silently."""
    import logging

    logger = logging.getLogger(__name__)

    if not tracing_enabled():
        logger.info("LangSmith tracing disabled (set LANGCHAIN_TRACING_V2=true to enable)")
        return

    if not os.environ.get("LANGCHAIN_API_KEY"):
        logger.warning(
            "LANGCHAIN_TRACING_V2=true but LANGCHAIN_API_KEY is not set - "
            "traces will fail to upload. Set it in your .env."
        )
        return

    project = os.environ.get("LANGCHAIN_PROJECT", "default")
    logger.info(f"LangSmith tracing enabled - project '{project}'")


def agent_run_config(
    agent: str,
    bid_id: str,
    doc_type: str,
    *,
    provider: str | None = None,
    document_id: str | None = None,
) -> dict[str, object]:
    """Standard run_name/tags/metadata for one agent's `run_deep_agent` call.
    Filter on these in the LangSmith UI (by tag, or by a metadata key) to
    pull up e.g. every legal-agent run for a given bid, or every run that
    hit a specific provider."""
    return {
        "run_name": f"{agent}_agent",
        "tags": [agent, doc_type, provider or "default-provider"],
        "metadata": {
            "agent": agent,
            "bid_id": bid_id,
            "doc_type": doc_type,
            "provider": provider,
            "document_id": document_id,
        },
    }
