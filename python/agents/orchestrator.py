"""Document-routing orchestrator.

Runs once per bid, before the legal/engineering/accounting agents (see
graph/pipeline.py). Reads the whole document and splits it into three
excerpts - one per domain - so each downstream agent only ever receives the
content relevant to its own specialty instead of the entire document: the
engineering agent sees technical scope/specifications, not liability
clauses; the legal agent sees contract terms/liabilities, not structural
specs; the accounting agent sees costs/payment terms, not either.

Unlike app.document_sections' keyword filter (still used as this module's
fallback), routing here is judgment-based - an LLM reads the document, so
it can route a paragraph correctly even when it doesn't contain any of the
expected keywords (e.g. "the contractor shall bear all costs arising from
delay" is a legal/liability statement, but reads like neither a keyword
list nor a section heading would predict).
"""

from __future__ import annotations

import logging
import os

from langchain_core.messages import HumanMessage, SystemMessage

from agents.parsing import extract_json_block
from agents.tracing import agent_run_config
from app.document_sections import DOMAINS, filter_text_for_domain
from models import get_model

logger = logging.getLogger(__name__)

# Same env-configurable default as agents/nodes.py (kept in sync manually -
# see that module's DEFAULT_PROVIDER comment for why this isn't hardcoded).
DEFAULT_PROVIDER = os.environ.get("DEFAULT_LLM_PROVIDER", "anthropic")

_ORCHESTRATOR_SYSTEM_PROMPT = """You are a document routing orchestrator for an EPC (Engineering, Procurement, and Construction) tender analysis system. You read a full tender/contract document once and split it into three excerpts, one per downstream specialist:

1. **legal_content**: contract terms, liabilities, indemnities, warranties, termination, dispute resolution, compliance/regulatory requirements, penalties, liquidated damages, insurance/bonding obligations - anything a contract lawyer needs.
2. **engineering_content**: project scope, technical specifications, materials, structural/design requirements, site conditions, quality/safety standards, construction methodology, schedule/timeline - anything a construction engineer needs.
3. **accounting_content**: costs, pricing, payment terms/schedule, invoicing, retention, financial qualification requirements, cash flow implications - anything a project accountant needs.

## Rules
- Extract and REPRODUCE the relevant original text VERBATIM (do not summarize, paraphrase, or invent content) - including any page/section citations already present (e.g. "[page:5, section:2.1]").
- A sentence or clause that's relevant to more than one domain (e.g. a payment milestone tied to an engineering deliverable) may appear in more than one excerpt - that's expected, not an error.
- Only include content actually relevant to that domain. Do not pad any excerpt with irrelevant material just to make it longer.
- If a domain has genuinely little or no relevant content in this document, its excerpt can be short - do not fabricate content to fill it.

## Output Format
Respond with ONLY this JSON object, no other text:
```json
{
  "legal_content": "...",
  "engineering_content": "...",
  "accounting_content": "..."
}
```"""


# The orchestrator reproduces document text verbatim into three excerpts, so
# its output scales with the input rather than being a short summary - and
# clauses relevant to two domains are deliberately repeated. A fixed budget
# silently truncates the JSON mid-string on longer documents, which reads in
# the logs as unparseable output and drops routing to the keyword fallback.
# Estimate from input size instead: ~4 chars/token, x1.5 for cross-domain
# overlap and JSON overhead.
_MIN_OUTPUT_TOKENS = 4096
_MAX_OUTPUT_TOKENS = 16384


def _output_budget_for(document_text: str) -> int:
    estimated = int((len(document_text) / 4) * 1.5)
    return max(_MIN_OUTPUT_TOKENS, min(estimated, _MAX_OUTPUT_TOKENS))


def _fallback_routing(document_text: str) -> dict[str, str]:
    """Deterministic keyword-based routing (app.document_sections) used
    when the LLM call fails or returns unparseable output - degraded but
    still domain-scoped, never falls all the way back to hand every agent
    the entire document."""
    return {domain: filter_text_for_domain(document_text, domain) for domain in DOMAINS}


async def route_document_content(
    document_text: str | None,
    doc_type: str,
    bid_id: str,
    *,
    provider: str | None = None,
    model: str | None = None,
) -> dict[str, str]:
    """Returns {"legal": ..., "engineering": ..., "accounting": ...} - the
    per-domain excerpts each downstream agent should receive instead of the
    full document."""
    if not document_text or not document_text.strip():
        return {domain: "" for domain in DOMAINS}

    resolved_provider = provider or DEFAULT_PROVIDER
    try:
        chat_model = get_model(
            resolved_provider, model, temperature=0.0, max_tokens=_output_budget_for(document_text)
        )
        response = await chat_model.ainvoke(
            [
                SystemMessage(content=_ORCHESTRATOR_SYSTEM_PROMPT),
                HumanMessage(
                    content=f"Route the relevant content from this {doc_type} document:\n\n{document_text}"
                ),
            ],
            config=agent_run_config("orchestrator", bid_id, doc_type, provider=resolved_provider),
        )
        content = str(response.content)
        parsed = extract_json_block(content)
        if not parsed:
            # Distinguish a truncated response from genuinely malformed output.
            # Truncation means the token budget was too small for this
            # document, which is actionable; "model ignored the format" is a
            # different problem. Without this the two look identical in logs.
            if content.rstrip().endswith("}"):
                raise ValueError("Orchestrator response did not contain a parseable JSON block")
            raise ValueError(
                f"Orchestrator response was cut off before the JSON closed - the token "
                f"budget was too small for this document ({len(document_text)} chars in, "
                f"{len(content)} chars out). See _output_budget_for."
            )

        routed = {
            "legal": str(parsed.get("legal_content") or "").strip(),
            "engineering": str(parsed.get("engineering_content") or "").strip(),
            "accounting": str(parsed.get("accounting_content") or "").strip(),
        }
        # A domain the model left empty still needs *something* to analyze -
        # fall back to the keyword filter for that one domain only, rather
        # than discarding the (successful) routing for the other two.
        fallback: dict[str, str] | None = None
        for domain, text in routed.items():
            if not text:
                fallback = fallback or _fallback_routing(document_text)
                routed[domain] = fallback[domain]
        return routed
    except Exception:
        logger.warning("Document routing orchestrator failed, falling back to keyword filter", exc_info=True)
        return _fallback_routing(document_text)
