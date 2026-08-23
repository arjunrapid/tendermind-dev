"""Company-knowledge indexing + retrieval.

After a bid finishes analysis, `index_bid_knowledge` turns each agent's
assessment (plus pricing/BOQ) into embedded chunks tagged with a `domain`
(legal/engineering/accounting/risk/pricing) and stores them in
`knowledge_chunks` (app.db). On the *next* upload, `retrieve_domain_context`
embeds the new document and pulls back only that agent's own domain of
history - the legal agent never sees engineering chunks and vice versa.
"""

from __future__ import annotations

import logging
from typing import Any

from app import db
from app.embeddings import embed_text

logger = logging.getLogger(__name__)

DOMAINS = ("legal", "engineering", "accounting", "risk", "pricing")


def _assessment_to_text(assessment: dict[str, Any]) -> str:
    """Flatten an agent's assessment dict (lists of bullet strings + summary
    fields) into a single text blob suitable for embedding."""
    parts: list[str] = []
    for key, value in assessment.items():
        if key == "provider_used":
            continue
        if isinstance(value, list):
            parts.extend(str(v) for v in value)
        elif value is not None:
            parts.append(f"{key}: {value}")
    return "\n".join(parts)


async def index_bid_knowledge(
    bid_id: str,
    doc_type: str,
    *,
    legal_assessment: dict[str, Any],
    engineering_assessment: dict[str, Any],
    accounting_assessment: dict[str, Any],
    risk_assessment: dict[str, Any],
    pricing_breakdown: dict[str, Any],
) -> None:
    """Embed this bid's per-domain assessments and persist them so future
    uploads can retrieve similar company history. Best-effort: a failure
    here must never fail the bid analysis it's indexing."""
    sources: list[tuple[str, str, dict[str, Any]]] = [
        ("legal", "assessment", legal_assessment),
        ("engineering", "assessment", engineering_assessment),
        ("accounting", "assessment", accounting_assessment),
        ("risk", "assessment", risk_assessment),
        ("pricing", "pricing_breakdown", pricing_breakdown),
    ]

    chunks: list[dict[str, Any]] = []
    for domain, source_type, payload in sources:
        text = _assessment_to_text(payload)
        if not text.strip():
            continue
        try:
            embedding = await embed_text(text)
        except Exception:
            logger.warning("Failed to embed %s knowledge for bid %s", domain, bid_id, exc_info=True)
            continue
        chunks.append(
            {
                "bid_id": bid_id,
                "source_type": source_type,
                "domain": domain,
                "chunk_text": text[:4000],
                "embedding": embedding,
                "metadata": {"doc_type": doc_type},
            }
        )

    try:
        await db.save_knowledge_chunks(chunks)
    except Exception:
        logger.warning("Failed to save knowledge chunks for bid %s", bid_id, exc_info=True)


def _format_context(domain: str, chunks: list[dict[str, Any]]) -> str:
    if not chunks:
        return f"No similar past {domain} history found in company knowledge base."
    lines = [f"Based on {len(chunks)} similar past {domain} analyses (most similar first):", ""]
    for i, chunk in enumerate(chunks, start=1):
        doc_type = (chunk.get("metadata") or {}).get("doc_type", "unknown")
        similarity = chunk.get("similarity", 0)
        lines.append(f"{i}. [{doc_type}, similarity={similarity:.2f}] {chunk['chunk_text'][:600]}")
        lines.append("")
    return "\n".join(lines)


async def retrieve_domain_context(
    document_text: str | None, domain: str, *, bid_id: str | None = None, k: int = 3
) -> str:
    """Embed the new document and fetch only this domain's similar past
    chunks. Returns a formatted string ready to inject into that agent's
    prompt; never raises - retrieval failure just means no extra context."""
    if not document_text:
        return f"No similar past {domain} history available (no document text)."
    try:
        query_embedding = await embed_text(document_text)
        chunks = await db.query_similar_chunks(query_embedding, domain, k=k, exclude_bid_id=bid_id)
    except Exception:
        logger.warning("Failed to retrieve %s knowledge context", domain, exc_info=True)
        return f"No similar past {domain} history available (retrieval error)."
    return _format_context(domain, chunks)
