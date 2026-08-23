"""Splits a document's text into per-domain slices (legal/engineering/
accounting) so each agent only ever sees the paragraphs relevant to its own
specialty, not the entire document. Deterministic keyword matching - no LLM
call - matching this codebase's preference for mechanical, auditable
preprocessing over another model call.
"""

from __future__ import annotations

import re

DOMAINS = ("legal", "engineering", "accounting")

# Keyword sets are intentionally broad (near-synonyms included) since a
# paragraph only needs one hit to be kept - false positives (an irrelevant
# paragraph kept) are cheap, false negatives (a relevant paragraph dropped)
# are the risk worth avoiding.
DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "legal": [
        "contract", "clause", "liability", "indemni", "warrant", "termination",
        "dispute", "arbitration", "governing law", "force majeure", "compliance",
        "regulation", "penalty", "liquidated damages", "breach", "default",
        "confidential", "intellectual property", "insurance", "bond", "guarantee",
        "retention", "notice period", "jurisdiction", "statutory",
    ],
    "engineering": [
        "scope", "specification", "drawing", "structural", "foundation", "design",
        "material", "load", "safety factor", "site", "construction", "installation",
        "equipment", "quality", "standard", "tolerance", "inspection", "testing",
        "commissioning", "schedule", "timeline", "milestone", "geotechnical",
        "civil", "mechanical", "electrical", "hvac", "steel", "concrete", "roofing",
    ],
    "accounting": [
        "cost", "price", "payment", "invoice", "budget", "expense", "milestone payment",
        "retention", "advance", "bank guarantee", "performance security", "cash flow",
        "turnover", "financial", "qualification", "revenue", "currency", "escalation",
        "contingency", "profit", "margin", "rate", "quantity", "boq", "bill of quantities",
    ],
}


def _split_paragraphs(text: str) -> list[str]:
    paragraphs = re.split(r"\n\s*\n", text)
    if len(paragraphs) <= 1:
        # No blank-line paragraph breaks (common in extracted PDF text) -
        # fall back to splitting on single newlines / sentence boundaries.
        paragraphs = re.split(r"(?<=[.!?])\s+(?=[A-Z])|\n", text)
    return [p.strip() for p in paragraphs if p.strip()]


def filter_text_for_domain(text: str, domain: str, *, min_chars: int = 400) -> str:
    """Return only the paragraphs of `text` that mention this domain's
    keywords, in original order. Falls back to the full text if filtering
    would leave too little content to analyze (`min_chars`) - a document
    that simply doesn't use the expected vocabulary shouldn't starve the
    agent of any context at all."""
    keywords = DOMAIN_KEYWORDS.get(domain, [])
    if not keywords or not text:
        return text

    paragraphs = _split_paragraphs(text)
    pattern = re.compile("|".join(re.escape(k) for k in keywords), re.IGNORECASE)

    matched = [p for p in paragraphs if pattern.search(p)]
    filtered = "\n\n".join(matched)

    if len(filtered) < min_chars:
        return text

    return filtered
