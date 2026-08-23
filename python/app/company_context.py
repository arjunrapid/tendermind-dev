"""Company context: admin-curated reference material (policies, standard
terms, engineering standards, accounting practices, ...) uploaded as plain
text, Markdown, or PDF, categorized by domain, and injected into every
analysis for the matching agent - see agents/nodes.py.

Unlike app/knowledge.py's pgvector retrieval (which surfaces content from
*past bid analyses*, filtered by similarity to the *current* document),
this is curated once by a human and applied in full to every run for its
category - no retrieval/similarity step, no decay, no dependency on prior
bids existing yet.
"""

from __future__ import annotations

import logging

from app import db
from app.document_sections import DOMAIN_KEYWORDS

logger = logging.getLogger(__name__)

CATEGORIES = ("legal", "engineering", "accounting", "risk")

# Keeps a very large set of uploaded documents from blowing out an agent's
# context window - if this is ever hit in practice, splitting per-category
# content across more targeted uploads is the fix, not raising this further.
MAX_CONTEXT_CHARS = 12000

# Reuses app.document_sections' legal/engineering/accounting keyword lists
# (same source of truth used to route document content to agents) and adds
# a "risk" list of its own, since document_sections only splits content
# across the three LLM-backed agents - risk aggregation is deterministic
# (agents/risk.py) and never receives routed content.
_RISK_KEYWORDS = [
    "risk", "mitigation", "exposure", "contingency", "escalation", "risk appetite",
    "risk register", "worst case", "risk tolerance", "hazard", "uncertainty", "likelihood",
]

_CATEGORY_KEYWORDS: dict[str, list[str]] = {**DOMAIN_KEYWORDS, "risk": _RISK_KEYWORDS}


def classify_category(text: str) -> str:
    """Best-guess category for an uploaded company-context entry, by
    keyword hit count - the admin no longer has to tag every upload by
    hand. Falls back to "legal" (the broadest bucket) when nothing scores,
    e.g. a very short or generic upload with no domain vocabulary at all."""
    if not text:
        return "legal"
    text_lower = text.lower()
    scores = {
        category: sum(text_lower.count(keyword) for keyword in keywords)
        for category, keywords in _CATEGORY_KEYWORDS.items()
    }
    best_category = max(scores, key=lambda c: scores[c])
    return best_category if scores[best_category] > 0 else "legal"


async def get_context_for_category(category: str) -> str:
    """All curated company-context entries for one category, concatenated
    into a single block ready to inject into that agent's system prompt.
    Empty string (not an error) when nothing has been uploaded yet."""
    try:
        rows = await db.get_company_context(category=category)
    except Exception:
        logger.warning("Failed to load company context for %s", category, exc_info=True)
        return ""

    if not rows:
        return ""

    parts = [f"### {row['title']}\n{row['content']}" for row in rows]
    combined = "\n\n".join(parts)
    return combined[:MAX_CONTEXT_CHARS]
