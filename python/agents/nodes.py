"""
The three document-analysis agents (legal, engineering, accounting).

Each one is a thin wrapper: pick a model via `models.get_model(...)`, hand
its system prompt + the document text to the reusable `run_deep_agent(...)`,
then parse the JSON (with a regex fallback) out of the reply. All three
share the exact same shape, so `graph/pipeline.py` can fan them out in
parallel with no agent-specific wiring beyond "which prompt, which parser".
"""

from __future__ import annotations

import logging
import os
from typing import Any

from agents.deep_agent import last_message_text, run_deep_agent
from agents.parsing import extract_bullet_points, extract_json_block, extract_rating_line, parse_array
from agents.prompts import (
    ACCOUNTING_AGENT_SYSTEM_PROMPT,
    ENGINEERING_AGENT_SYSTEM_PROMPT,
    LEGAL_AGENT_SYSTEM_PROMPT,
    tool_user_message_for,
    user_message_for,
)
from agents.tools import company_context_tool_for_domain, document_tools_for_domain
from agents.tracing import agent_run_config
from app.document_sections import filter_text_for_domain
from app.knowledge import retrieve_domain_context
from app.memory import extract_and_save_memory, inject_memory_context
from models import get_model

logger = logging.getLogger(__name__)

# Which provider an agent call uses when the caller doesn't specify one
# (e.g. a UI upload that never sends `provider`). Env-configurable rather
# than hardcoded so this can point at whichever provider's API key is
# actually populated - a hardcoded "anthropic" fails every agent with
# "Missing API key" the moment ANTHROPIC_API_KEY is empty, even if e.g.
# OPENROUTER_API_KEY is set and working.
DEFAULT_PROVIDER = os.environ.get("DEFAULT_LLM_PROVIDER", "anthropic")


def _model_for(provider: str | None, model: str | None):
    return get_model(provider or DEFAULT_PROVIDER, model, temperature=0.7, max_tokens=4096)


async def _inject_knowledge(system_prompt: str, domain: str, document_text: str | None, bid_id: str) -> str:
    """Append this agent's own domain-scoped company knowledge (similar past
    legal/engineering/accounting/risk history) to its system prompt. Never
    lets another agent's domain leak in - each call is filtered by `domain`
    at the pgvector query level (see app.knowledge.retrieve_domain_context)."""
    context = await retrieve_domain_context(document_text, domain, bid_id=bid_id)
    return f"{system_prompt}\n\n## SIMILAR PAST {domain.upper()} HISTORY (COMPANY KNOWLEDGE BASE)\n{context}"


def _tools_for(agent: str, routed_text: str | None) -> list:
    """Document extraction is only offered when the agent actually needs it
    to get its content - giving the model that tool when `routed_text` is
    already in the prompt invites it to call it anyway (observed with some
    models eagerly calling `extract_document_text` with a guessed/
    hallucinated document_id, which then raises `FileNotFoundError` and
    fails the whole agent run).

    `get_company_context` is always offered, independent of routed_text:
    it's an on-demand lookup (curated policies/standards an admin uploaded
    via the Company Context page), not part of the current document's
    content, so there's no equivalent "already in the prompt" case for it -
    see agents/tools.py company_context_tool_for_domain."""
    extraction_tools = [] if routed_text else document_tools_for_domain(agent)
    return extraction_tools + company_context_tool_for_domain(agent)


def _user_message(
    agent: str,
    doc_type: str,
    document_text: str | None,
    document_id: str | None,
    routed_text: str | None,
) -> str:
    """Three ways to get this agent its content, in priority order:

    1. `routed_text` - the orchestrator (agents/orchestrator.py) already read
       the whole document once and produced this agent's own excerpt. This is
       the normal path whenever the pipeline (graph/pipeline.py) is used.
    2. `document_id` - no orchestrator output available, so fall back to the
       tool-call form: the agent calls `extract_document_text` itself, which
       is itself domain-scoped per agent (agents.tools.document_tools_for_domain).
    3. `document_text` - inline text with this codebase's deterministic
       keyword filter (app.document_sections) applied, for callers with
       neither routed content nor a document store (e.g. the standalone CLI).

    Whichever path runs, the agent never receives the full, unfiltered
    document - only its own domain's slice of it."""
    if routed_text:
        return user_message_for(agent, doc_type, routed_text)
    if document_id:
        return tool_user_message_for(agent, doc_type, document_id)
    domain_text = filter_text_for_domain(document_text or "", agent)
    return user_message_for(agent, doc_type, domain_text)


async def legal_agent(
    document_text: str | None,
    bid_id: str,
    doc_type: str,
    *,
    document_id: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    routed_text: str | None = None,
) -> dict[str, Any]:
    resolved_provider = provider or DEFAULT_PROVIDER
    try:
        enriched_prompt = inject_memory_context(LEGAL_AGENT_SYSTEM_PROMPT, "legal", document_text)
        enriched_prompt = await _inject_knowledge(enriched_prompt, "legal", document_text, bid_id)
        result_state = await run_deep_agent(
            system_prompt=enriched_prompt,
            user_message=_user_message("legal", doc_type, document_text, document_id, routed_text),
            tools=_tools_for("legal", routed_text),
            model=_model_for(provider, model),
            **agent_run_config("legal", bid_id, doc_type, provider=resolved_provider, document_id=document_id),
        )
        content = last_message_text(result_state)
        parsed = extract_json_block(content)
        if parsed:
            result = {
                "compliance_issues": parse_array(parsed.get("compliance_issues")),
                "contract_terms": parse_array(parsed.get("contract_terms")),
                "risks": parse_array(parsed.get("risks")),
                "overall_assessment": str(parsed.get("overall_assessment") or "Assessment incomplete"),
            }
        else:
            result = {
                "compliance_issues": extract_bullet_points(content, "compliance"),
                "contract_terms": extract_bullet_points(content, "terms"),
                "risks": extract_bullet_points(content, "risk"),
                "overall_assessment": extract_rating_line(content),
            }
        try:
            extract_and_save_memory("legal", content, bid_id, doc_type)
        except Exception:
            logger.warning("Failed to save legal agent memory", exc_info=True)
        result["provider_used"] = resolved_provider
        return result
    except Exception:
        logger.exception("legal_agent failed")
        return {
            "compliance_issues": ["Error during analysis - manual review required"],
            "contract_terms": [],
            "risks": ["Unable to complete automated analysis"],
            "overall_assessment": "RED: Analysis failed - requires manual legal review",
            "provider_used": "error",
        }


async def engineering_agent(
    document_text: str | None,
    bid_id: str,
    doc_type: str,
    *,
    document_id: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    routed_text: str | None = None,
) -> dict[str, Any]:
    resolved_provider = provider or DEFAULT_PROVIDER
    try:
        enriched_prompt = inject_memory_context(ENGINEERING_AGENT_SYSTEM_PROMPT, "engineering", document_text)
        enriched_prompt = await _inject_knowledge(enriched_prompt, "engineering", document_text, bid_id)
        result_state = await run_deep_agent(
            system_prompt=enriched_prompt,
            user_message=_user_message("engineering", doc_type, document_text, document_id, routed_text),
            tools=_tools_for("engineering", routed_text),
            model=_model_for(provider, model),
            **agent_run_config("engineering", bid_id, doc_type, provider=resolved_provider, document_id=document_id),
        )
        content = last_message_text(result_state)
        parsed = extract_json_block(content)
        if parsed:
            result = {
                "scope_analysis": parse_array(parsed.get("scope_analysis")),
                "structural_concerns": parse_array(parsed.get("structural_concerns")),
                "timeline_estimate": str(parsed.get("timeline_estimate") or "Timeline not specified"),
                "feasibility": str(parsed.get("feasibility") or "MEDIUM - Insufficient data"),
                "site_requirements": parse_array(parsed.get("site_requirements")),
            }
        else:
            result = {
                "scope_analysis": extract_bullet_points(content, "scope"),
                "structural_concerns": extract_bullet_points(content, "structural"),
                "timeline_estimate": extract_rating_line(content, ("HIGH", "MEDIUM", "LOW")),
                "feasibility": extract_rating_line(content, ("HIGH", "MEDIUM", "LOW")),
                "site_requirements": extract_bullet_points(content, "site"),
            }
        try:
            extract_and_save_memory("engineering", content, bid_id, doc_type)
        except Exception:
            logger.warning("Failed to save engineering agent memory", exc_info=True)
        result["provider_used"] = resolved_provider
        return result
    except Exception:
        logger.exception("engineering_agent failed")
        return {
            "scope_analysis": [],
            "structural_concerns": ["Unable to complete automated analysis"],
            "timeline_estimate": "Unknown - manual review required",
            "feasibility": "UNKNOWN: Analysis failed - requires manual engineering review",
            "site_requirements": [],
            "provider_used": "error",
        }


async def accounting_agent(
    document_text: str | None,
    bid_id: str,
    doc_type: str,
    *,
    document_id: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    routed_text: str | None = None,
) -> dict[str, Any]:
    resolved_provider = provider or DEFAULT_PROVIDER
    try:
        enriched_prompt = inject_memory_context(ACCOUNTING_AGENT_SYSTEM_PROMPT, "accounting", document_text)
        enriched_prompt = await _inject_knowledge(enriched_prompt, "accounting", document_text, bid_id)
        result_state = await run_deep_agent(
            system_prompt=enriched_prompt,
            user_message=_user_message("accounting", doc_type, document_text, document_id, routed_text),
            tools=_tools_for("accounting", routed_text),
            model=_model_for(provider, model),
            **agent_run_config("accounting", bid_id, doc_type, provider=resolved_provider, document_id=document_id),
        )
        content = last_message_text(result_state)
        parsed = extract_json_block(content)
        if parsed:
            result = {
                "cost_analysis": parse_array(parsed.get("cost_analysis")),
                "payment_terms": parse_array(parsed.get("payment_terms")),
                "qualification_requirements": parse_array(parsed.get("qualification_requirements")),
                "cash_flow_analysis": str(parsed.get("cash_flow_analysis") or "Cash flow analysis incomplete"),
                "financial_risk": str(parsed.get("financial_risk") or "MEDIUM - Insufficient data"),
            }
        else:
            cash_flow_match = next(
                (line for line in content.split(".") if "cash flow" in line.lower()),
                content[:500],
            )
            result = {
                "cost_analysis": extract_bullet_points(content, "cost"),
                "payment_terms": extract_bullet_points(content, "payment"),
                "qualification_requirements": extract_bullet_points(content, "qualification"),
                "cash_flow_analysis": cash_flow_match.strip(),
                "financial_risk": extract_rating_line(content, ("HIGH", "MEDIUM", "LOW")),
            }
        try:
            extract_and_save_memory("accounting", content, bid_id, doc_type)
        except Exception:
            logger.warning("Failed to save accounting agent memory", exc_info=True)
        result["provider_used"] = resolved_provider
        return result
    except Exception:
        logger.exception("accounting_agent failed")
        return {
            "cost_analysis": [],
            "payment_terms": [],
            "qualification_requirements": ["Unable to complete automated analysis"],
            "cash_flow_analysis": "Analysis failed - requires manual accounting review",
            "financial_risk": "HIGH: Analysis failed - requires manual accounting review",
            "provider_used": "error",
        }
