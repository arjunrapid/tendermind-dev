"""Thin embedding client.

Tries OpenRouter first (`OPENROUTER_API_KEY`), since that's the provider
requested for this feature. OpenRouter's public API is chat/completions
oriented and doesn't reliably expose `/embeddings` for every model, so on
any failure (missing key, 404, unsupported model) this falls back to
calling OpenAI's embeddings API directly via `OPENAI_API_KEY`, which is
already configured for the LLM agents. Both paths return the same
`list[float]` shape so callers never need to know which one ran.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_EMBEDDING_MODEL = os.environ.get("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small")
OPENAI_EMBEDDING_MODEL = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIM = 1536  # text-embedding-3-small

_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


# A bad key, a plan without embeddings access, or a model OpenRouter doesn't
# serve on /embeddings fails identically on every call - retrying per embed
# buys nothing but a wasted round-trip and a duplicate traceback in the logs
# (one analyze request embeds several times). Latch those off after the first
# occurrence; transient failures (timeouts, 5xx, 429) still retry normally.
_openrouter_disabled_reason: str | None = None
# Separate from the latch above: a bid embeds several chunks concurrently, so
# the first batch all get past the latch check before any of them fails and
# sets it. The latch still spares every *later* call, but without this flag
# that first batch would log the same warning once per concurrent request.
_openrouter_failure_logged = False

_PERMANENT_STATUSES = frozenset({401, 403, 404})


async def _embed_via_openrouter(text: str) -> list[float] | None:
    global _openrouter_disabled_reason, _openrouter_failure_logged

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key or _openrouter_disabled_reason is not None:
        return None
    try:
        resp = await _http().post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": OPENROUTER_EMBEDDING_MODEL, "input": text},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"][0]["embedding"]
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in _PERMANENT_STATUSES:
            _openrouter_disabled_reason = f"HTTP {status}"
            if not _openrouter_failure_logged:
                _openrouter_failure_logged = True
                logger.warning(
                    "OpenRouter embeddings unavailable (HTTP %s for model %s) - using OpenAI for "
                    "embeddings from now on. Check OPENROUTER_API_KEY and "
                    "OPENROUTER_EMBEDDING_MODEL if this is unexpected; logged once per process.",
                    status,
                    OPENROUTER_EMBEDDING_MODEL,
                )
        else:
            logger.warning(
                "OpenRouter embeddings call failed (HTTP %s), falling back to OpenAI", status
            )
        return None
    except Exception:
        logger.warning("OpenRouter embeddings call failed, falling back to OpenAI", exc_info=True)
        return None


async def _embed_via_openai(text: str) -> list[float]:
    api_key = os.environ["OPENAI_API_KEY"]
    resp = await _http().post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"model": OPENAI_EMBEDDING_MODEL, "input": text},
    )
    resp.raise_for_status()
    data = resp.json()
    return data["data"][0]["embedding"]


async def embed_text(text: str) -> list[float]:
    """Embed a single piece of text, OpenRouter first then OpenAI fallback."""
    text = text[:8000]  # keep well under embedding model input limits
    embedding = await _embed_via_openrouter(text)
    if embedding is not None:
        return embedding
    return await _embed_via_openai(text)
