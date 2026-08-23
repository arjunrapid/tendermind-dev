"""Postgres access layer. Ported from lib/db.ts, using asyncpg against the
same Neon/Vercel Postgres database (`DATABASE_URL`)."""

from __future__ import annotations

import json
import os
from typing import Any

import asyncpg
from pgvector.asyncpg import register_vector

from app.boq import DEFAULT_BOQ_ITEMS, BoqItem
from app.embeddings import EMBEDDING_DIM

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    dsn = os.environ["DATABASE_URL"]
    _pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10, init=_register_vector_codec)
    await _initialize_schema()


async def _register_vector_codec(conn: asyncpg.Connection) -> None:
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    await register_vector(conn)


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized - call init_pool() on app startup")
    return _pool


async def _initialize_schema() -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bids (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                file_name TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                extracted_text TEXT,
                classification_confidence FLOAT,
                legal_assessment JSONB,
                engineering_assessment JSONB,
                accounting_assessment JSONB,
                pricing_breakdown JSONB,
                risk_score FLOAT,
                risk_factors JSONB,
                recommendation JSONB,
                llm_provider_used TEXT,
                processing_time_ms INT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS extracted_clauses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
                clause_type TEXT,
                text TEXT,
                page_number INT,
                section_reference TEXT,
                confidence FLOAT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_clauses_bid_id ON extracted_clauses(bid_id);")
        await conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
                source_type TEXT NOT NULL,
                domain TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                embedding vector({EMBEDDING_DIM}) NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_domain ON knowledge_chunks(domain);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_bid_id ON knowledge_chunks(bid_id);")
        await conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
            ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS boq_defaults (
                item_key TEXT PRIMARY KEY,
                item_name TEXT NOT NULL,
                item_type TEXT NOT NULL,
                quantity FLOAT,
                unit TEXT,
                unit_rate FLOAT,
                lump_sum_amount FLOAT,
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agent_model_overrides (
                agent TEXT PRIMARY KEY,
                provider TEXT,
                model TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            );
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS company_context (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source_type TEXT NOT NULL,
                file_name TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_company_context_category ON company_context(category);"
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS counterparty_lookups (
                company_name_normalized TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                result JSONB NOT NULL,
                fetched_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL
            );
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'analyst',
                created_at TIMESTAMP DEFAULT NOW()
            );
            """
        )
        await _seed_default_users(conn)


async def _seed_default_users(conn: asyncpg.Connection) -> None:
    """Seed the two demo accounts on first startup if they don't exist yet.
    Passwords are read from environment variables so they are never hardcoded.
    Falls back to the old demo values when the env vars are absent so the
    development experience is unchanged without any .env setup."""
    from app.auth import hash_password

    admin_password = os.environ.get("AUTH_ADMIN_PASSWORD", "tmadmin123")
    analyst_password = os.environ.get("AUTH_ANALYST_PASSWORD", "tmanalyst123")

    defaults = [
        ("tmadmin", admin_password, "Tender Admin", "admin"),
        ("tmanalyst", analyst_password, "Tender Analyst", "analyst"),
    ]
    for username, password, name, role in defaults:
        existing = await conn.fetchrow("SELECT id FROM users WHERE username = $1;", username)
        if not existing:
            await conn.execute(
                "INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, $4);",
                username,
                hash_password(password),
                name,
                role,
            )


async def get_user_by_username(username: str) -> dict[str, Any] | None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE username = $1;", username)
    if not row:
        return None
    d = dict(row)
    d["id"] = str(d["id"])
    d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
    return d


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    d = dict(row)
    for key in ("legal_assessment", "engineering_assessment", "accounting_assessment",
                "pricing_breakdown", "risk_factors", "recommendation"):
        if isinstance(d.get(key), str):
            d[key] = json.loads(d[key])
    d["id"] = str(d["id"])
    d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
    return d


async def save_bid(bid: dict[str, Any]) -> dict[str, Any]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        if bid.get("id"):
            row = await conn.fetchrow(
                """
                INSERT INTO bids (
                    id, file_name, doc_type, extracted_text, classification_confidence,
                    legal_assessment, engineering_assessment, accounting_assessment,
                    pricing_breakdown, risk_score, risk_factors, recommendation,
                    llm_provider_used, processing_time_ms
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *;
                """,
                bid["id"],
                bid["file_name"],
                bid["doc_type"],
                bid["extracted_text"],
                bid["classification_confidence"],
                json.dumps(bid["legal_assessment"]),
                json.dumps(bid["engineering_assessment"]),
                json.dumps(bid["accounting_assessment"]),
                json.dumps(bid["pricing_breakdown"]),
                bid["risk_score"],
                json.dumps(bid["risk_factors"]),
                json.dumps(bid["recommendation"]),
                bid["llm_provider_used"],
                bid["processing_time_ms"],
            )
        else:
            row = await conn.fetchrow(
                """
                INSERT INTO bids (
                    file_name, doc_type, extracted_text, classification_confidence,
                    legal_assessment, engineering_assessment, accounting_assessment,
                    pricing_breakdown, risk_score, risk_factors, recommendation,
                    llm_provider_used, processing_time_ms
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *;
                """,
                bid["file_name"],
                bid["doc_type"],
                bid["extracted_text"],
                bid["classification_confidence"],
                json.dumps(bid["legal_assessment"]),
                json.dumps(bid["engineering_assessment"]),
                json.dumps(bid["accounting_assessment"]),
                json.dumps(bid["pricing_breakdown"]),
                bid["risk_score"],
                json.dumps(bid["risk_factors"]),
                json.dumps(bid["recommendation"]),
                bid["llm_provider_used"],
                bid["processing_time_ms"],
            )
    return _row_to_dict(row)


async def get_bids(limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM bids ORDER BY created_at DESC LIMIT $1 OFFSET $2;", limit, offset
        )
    return [_row_to_dict(r) for r in rows]


async def get_bid_by_id(bid_id: str) -> dict[str, Any] | None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM bids WHERE id = $1;", bid_id)
    return _row_to_dict(row) if row else None


async def delete_bid(bid_id: str) -> dict[str, Any] | None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("DELETE FROM bids WHERE id = $1 RETURNING *;", bid_id)
    return _row_to_dict(row) if row else None


async def save_knowledge_chunks(chunks: list[dict[str, Any]]) -> None:
    """Persist embedded knowledge chunks (clauses/assessments/pricing/boq)
    tagged with their `domain` (legal/engineering/accounting/risk/pricing),
    so future bids can retrieve only the domain-relevant history for each
    agent. Each chunk: {bid_id, source_type, domain, chunk_text, embedding, metadata}."""
    if not chunks:
        return
    pool = _get_pool()
    async with pool.acquire() as conn:
        for chunk in chunks:
            await conn.execute(
                """
                INSERT INTO knowledge_chunks (bid_id, source_type, domain, chunk_text, embedding, metadata)
                VALUES ($1, $2, $3, $4, $5, $6);
                """,
                chunk["bid_id"],
                chunk["source_type"],
                chunk["domain"],
                chunk["chunk_text"],
                chunk["embedding"],
                json.dumps(chunk.get("metadata") or {}),
            )


async def query_similar_chunks(
    embedding: list[float],
    domain: str,
    k: int = 5,
    exclude_bid_id: str | None = None,
    min_similarity: float = 0.0,
) -> list[dict[str, Any]]:
    """Top-K most similar past chunks for a single domain (cosine distance
    via pgvector's `<=>` operator), filtered to ``min_similarity`` so
    low-relevance results don't pollute the agent's context.

    Retrieves up to ``k * 2`` rows from Postgres before filtering and
    deduplicating so the caller reliably gets up to ``k`` high-quality
    chunks after the similarity threshold is applied.
    """
    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT bid_id, source_type, domain, chunk_text, metadata, 1 - (embedding <=> $1) AS similarity
            FROM knowledge_chunks
            WHERE domain = $2 AND ($3::uuid IS NULL OR bid_id != $3)
            ORDER BY embedding <=> $1
            LIMIT $4;
            """,
            embedding,
            domain,
            exclude_bid_id,
            k * 2,  # over-fetch so we still have k after threshold filtering
        )
    results = []
    seen_texts: set[str] = set()
    for row in rows:
        d = dict(row)
        if isinstance(d.get("metadata"), str):
            d["metadata"] = json.loads(d["metadata"])
        d["bid_id"] = str(d["bid_id"])
        # Apply similarity threshold
        if d.get("similarity", 0) < min_similarity:
            continue
        # Deduplicate near-identical chunk text (first 200 chars fingerprint)
        fingerprint = d["chunk_text"][:200].strip()
        if fingerprint in seen_texts:
            continue
        seen_texts.add(fingerprint)
        results.append(d)
        if len(results) >= k:
            break
    return results


async def get_boq_defaults() -> list[BoqItem]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT item_key, item_name, item_type, quantity, unit, unit_rate, lump_sum_amount FROM boq_defaults;"
        )

    if not rows:
        await save_boq_defaults(DEFAULT_BOQ_ITEMS)
        return DEFAULT_BOQ_ITEMS

    by_key = {
        row["item_key"]: {
            "key": row["item_key"],
            "name": row["item_name"],
            "item_type": row["item_type"],
            "quantity": row["quantity"],
            "unit": row["unit"],
            "unit_rate": row["unit_rate"],
            "lump_sum_amount": row["lump_sum_amount"],
        }
        for row in rows
    }

    # Preserve the canonical item order regardless of row order.
    return [by_key.get(item["key"], item) for item in DEFAULT_BOQ_ITEMS]


async def save_boq_defaults(items: list[BoqItem]) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        for item in items:
            await conn.execute(
                """
                INSERT INTO boq_defaults (
                    item_key, item_name, item_type, quantity, unit, unit_rate, lump_sum_amount, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (item_key) DO UPDATE SET
                    item_name = EXCLUDED.item_name,
                    item_type = EXCLUDED.item_type,
                    quantity = EXCLUDED.quantity,
                    unit = EXCLUDED.unit,
                    unit_rate = EXCLUDED.unit_rate,
                    lump_sum_amount = EXCLUDED.lump_sum_amount,
                    updated_at = NOW();
                """,
                item["key"],
                item["name"],
                item["item_type"],
                item.get("quantity"),
                item.get("unit"),
                item.get("unit_rate"),
                item.get("lump_sum_amount"),
            )


async def get_agent_model_overrides() -> dict[str, dict[str, str | None]]:
    """{"legal": {"provider": "openrouter", "model": "openai/gpt-4.1"}, ...}
    - only agents with a saved row are present; an agent's absence means
    "use the environment default" (see agents/nodes.py DEFAULT_PROVIDER)."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT agent, provider, model FROM agent_model_overrides;")
    return {row["agent"]: {"provider": row["provider"], "model": row["model"]} for row in rows}


async def save_agent_model_overrides(overrides: dict[str, dict[str, str | None]]) -> None:
    """Each entry with neither a provider nor a model clears that agent's
    override (falls back to the environment default) rather than leaving a
    stale empty row behind."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        for agent, override in overrides.items():
            provider = override.get("provider") or None
            model = override.get("model") or None
            if provider is None and model is None:
                await conn.execute("DELETE FROM agent_model_overrides WHERE agent = $1;", agent)
                continue
            await conn.execute(
                """
                INSERT INTO agent_model_overrides (agent, provider, model, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (agent) DO UPDATE SET
                    provider = EXCLUDED.provider,
                    model = EXCLUDED.model,
                    updated_at = NOW();
                """,
                agent,
                provider,
                model,
            )


async def save_company_context(
    category: str, title: str, content: str, source_type: str, file_name: str | None
) -> dict[str, Any]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO company_context (category, title, content, source_type, file_name)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
            """,
            category,
            title,
            content,
            source_type,
            file_name,
        )
    d = dict(row)
    d["id"] = str(d["id"])
    d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
    return d


async def get_company_context(category: str | None = None) -> list[dict[str, Any]]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        if category:
            rows = await conn.fetch(
                "SELECT * FROM company_context WHERE category = $1 ORDER BY created_at DESC;", category
            )
        else:
            rows = await conn.fetch("SELECT * FROM company_context ORDER BY created_at DESC;")
    results = []
    for row in rows:
        d = dict(row)
        d["id"] = str(d["id"])
        d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
        results.append(d)
    return results


async def get_counterparty_lookup(company_name_normalized: str) -> dict[str, Any] | None:
    """Cached counterparty-verification result, or None on a cache miss/expiry
    (both treated the same by the caller - it just re-fetches)."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT result FROM counterparty_lookups WHERE company_name_normalized = $1 AND expires_at > NOW();",
            company_name_normalized,
        )
    if not row:
        return None
    result = row["result"]
    return json.loads(result) if isinstance(result, str) else result


async def save_counterparty_lookup(
    company_name_normalized: str, source: str, result: dict[str, Any], ttl_days: int
) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO counterparty_lookups (company_name_normalized, source, result, fetched_at, expires_at)
            VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' days')::interval)
            ON CONFLICT (company_name_normalized) DO UPDATE SET
                source = EXCLUDED.source,
                result = EXCLUDED.result,
                fetched_at = NOW(),
                expires_at = EXCLUDED.expires_at;
            """,
            company_name_normalized,
            source,
            json.dumps(result),
            str(ttl_days),
        )


async def delete_company_context(context_id: str) -> dict[str, Any] | None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("DELETE FROM company_context WHERE id = $1 RETURNING *;", context_id)
    if not row:
        return None
    d = dict(row)
    d["id"] = str(d["id"])
    d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
    return d
