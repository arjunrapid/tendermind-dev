"""Counterparty verification: checks the tender's issuing client/authority
against OpenSanctions' aggregated global sanctions, debarment, and PEP
watchlists - which include multilateral development bank debarred-firms
lists (World Bank, ADB, ...) relevant to internationally financed EPC
tenders - so the accounting agent can flag a barred or sanctioned
counterparty instead of taking the document's own description of the client
at face value.

Deterministic, no LLM involved - same shape as app/company_context.py's
get_context_for_category, wrapped as a tool in agents/tools.py. Results are
cached in Postgres (see app/db.py) since watchlist data changes slowly and a
given client/authority is often the counterparty on many bids.
"""

from __future__ import annotations

import logging
import os
import re

import httpx

from app import db

logger = logging.getLogger(__name__)

_API_URL = "https://api.opensanctions.org/match/default"
_CACHE_TTL_DAYS = 30
_TIMEOUT_SECONDS = 10.0

# A match below this fuzzy-name-similarity score is treated as unrelated to
# the queried company - OpenSanctions' free-text search returns loosely
# related results too, and a low-confidence hit on a common word in the name
# shouldn't be enough to flag a counterparty.
_MATCH_SCORE_THRESHOLD = 0.7

# Topics that make a match disqualifying on its own (feed risk.py's hard
# override), vs. merely worth surfacing as a softer signal.
_DEBARRING_TOPICS = {"debarment", "sanction"}

_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=_TIMEOUT_SECONDS)
    return _client


def normalize_company_name(name: str) -> str:
    """Cache key for a company name: lowercased, punctuation/whitespace
    collapsed, so 'Acme Corp.' and 'acme  corp' hit the same cache row."""
    return re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()


def _unavailable(entity_name: str, reason: str) -> dict:
    return {
        "status": "unavailable",
        "entity_name": entity_name,
        "registration_status": "unknown",
        "debarred": False,
        "summary": reason,
    }


def _interpret(company_name: str, results: list[dict]) -> dict:
    """Best match above the similarity threshold, or a clean-record result
    if none qualifies. Absence of a watchlist hit is the expected, good
    outcome for the vast majority of legitimate companies - unlike a company
    registry lookup, where "not found" is itself the red flag, here "not
    found on any sanctions/debarment list" is what a normal counterparty
    looks like.

    `topics` lives under each result's `properties`, not at the top level -
    verified against a live call (Gazprombank, a real OFAC-sanctioned
    entity) while building this, since a wrong key path here would silently
    read as an empty topic set and mark a sanctioned counterparty "verified"."""
    candidates = [r for r in results if (r.get("score") or 0) >= _MATCH_SCORE_THRESHOLD]
    if not candidates:
        return {
            "status": "verified",
            "entity_name": company_name,
            "registration_status": "no adverse findings",
            "debarred": False,
            "summary": f"No sanctions, debarment, or watchlist records found for '{company_name}'.",
        }

    best = max(candidates, key=lambda r: r.get("score") or 0)
    topics = set((best.get("properties") or {}).get("topics") or [])
    datasets = best.get("datasets") or []
    is_debarring = bool(topics & _DEBARRING_TOPICS)

    return {
        "status": "flagged",
        "entity_name": best.get("caption") or company_name,
        "registration_status": ", ".join(sorted(topics)) or "listed",
        "debarred": is_debarring,
        "summary": (
            f"{best.get('caption') or company_name} matched a watchlist record "
            f"(topics: {', '.join(sorted(topics)) or 'unspecified'}; "
            f"sources: {', '.join(datasets[:3]) or 'unspecified'})."
        ),
    }


async def _fetch_from_opensanctions(company_name: str) -> dict:
    api_key = os.environ.get("OPENSANCTIONS_API_KEY")
    if not api_key:
        return _unavailable(
            company_name,
            "Counterparty verification is not configured (no OPENSANCTIONS_API_KEY).",
        )

    # /match (not /search) - the scored entity-matching endpoint OpenSanctions
    # documents for automated screening. /search is free-text and returns no
    # `score` at all, which made an early version of this silently unable to
    # rank/threshold results.
    body = {
        "queries": {
            "q": {"schema": "LegalEntity", "properties": {"name": [company_name]}}
        }
    }
    try:
        resp = await _http().post(
            _API_URL,
            json=body,
            headers={"Authorization": f"ApiKey {api_key}"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.warning(
            "OpenSanctions lookup failed for %r", company_name, exc_info=True
        )
        return _unavailable(
            company_name,
            "Counterparty watchlist lookup failed - proceeding without verification.",
        )

    results = (data.get("responses") or {}).get("q", {}).get("results") or []
    return _interpret(company_name, results)


async def verify_counterparty(company_name: str) -> dict:
    """Look up `company_name` against OpenSanctions' aggregated sanctions/
    debarment/PEP watchlists (cached), returning: {status:
    verified|flagged|unavailable, entity_name, registration_status,
    debarred, summary}. Never raises - a lookup failure degrades to
    status="unavailable" so the calling agent can proceed on the document
    text alone."""
    if not company_name or not company_name.strip():
        return _unavailable(company_name, "No counterparty name provided.")

    normalized = normalize_company_name(company_name)
    try:
        cached = await db.get_counterparty_lookup(normalized)
    except Exception:
        logger.warning(
            "Counterparty cache read failed for %r", company_name, exc_info=True
        )
        cached = None
    if cached is not None:
        return cached

    result = await _fetch_from_opensanctions(company_name)

    # Only cache a real watchlist outcome (verified/flagged) - "unavailable"
    # means missing config or a transient failure, either of which might
    # resolve on the very next call, so caching it would just lock in the
    # failure for the full TTL.
    if result["status"] != "unavailable":
        try:
            await db.save_counterparty_lookup(
                normalized, "opensanctions", result, ttl_days=_CACHE_TTL_DAYS
            )
        except Exception:
            logger.warning(
                "Counterparty cache write failed for %r", company_name, exc_info=True
            )

    return result
