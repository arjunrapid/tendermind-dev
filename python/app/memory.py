"""File-based agent memory manager + injector.
Ported from lib/memory/manager.ts and lib/memory/injector.ts. Shares the
same on-disk store (repo-root `memory/agents/*.json`) as the TS app, so
memories saved by either implementation are visible to both."""

from __future__ import annotations

import json
import re
import time
import uuid
from pathlib import Path
from typing import Any

MEMORY_DIR = Path(__file__).resolve().parents[2] / "memory" / "agents"

_AGENT_KEYWORDS = {
    "legal": ["LD", "retention", "termination", "warranty", "indemnity", "arbitration"],
    "engineering": ["scope", "timeline", "site", "drawing", "specification"],
    "accounting": ["cost", "payment", "qualification", "criteria", "experience"],
    "risk": ["risk", "mitigation", "gap", "compliance", "exposure"],
}

_MEMORY_TYPE_BY_AGENT = {
    "legal": "clause_extraction",
    "engineering": "classification",
    "accounting": "cost_estimation",
    "risk": "risk_pattern",
}


class MemoryManager:
    def __init__(self) -> None:
        self._memories: dict[str, dict[str, Any]] = {}
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        for path in MEMORY_DIR.glob("*.json"):
            try:
                memory = json.loads(path.read_text())
                self._memories[memory["id"]] = memory
            except (json.JSONDecodeError, KeyError):
                continue
        self._loaded = True

    def _save_to_disk(self, memory: dict[str, Any]) -> None:
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        path = MEMORY_DIR / f"{memory['id']}.json"
        path.write_text(json.dumps(memory, indent=2))

    def save_memory(self, memory: dict[str, Any]) -> None:
        self._ensure_loaded()
        memory_id = memory.get("id") or f"mem_{int(time.time() * 1000)}_{uuid.uuid4().hex[:9]}"
        memory = {**memory, "id": memory_id}
        now = _now_iso()
        memory["metadata"] = {**memory["metadata"], "updated_at": now, "last_used": now}
        self._memories[memory_id] = memory
        self._save_to_disk(memory)

    def get_memories_for_agent(self, agent: str, limit: int = 5) -> list[dict[str, Any]]:
        self._ensure_loaded()
        results = [m for m in self._memories.values() if m.get("agent") == agent]
        results.sort(
            key=lambda m: (m["metadata"]["usage_count"], m["metadata"]["last_used"]),
            reverse=True,
        )
        return results[:limit]

    def record_memory_usage(self, memory_id: str) -> None:
        self._ensure_loaded()
        memory = self._memories.get(memory_id)
        if memory:
            memory["metadata"]["usage_count"] += 1
            memory["metadata"]["last_used"] = _now_iso()
            self._save_to_disk(memory)

    def delete_memory(self, memory_id: str) -> None:
        self._ensure_loaded()
        self._memories.pop(memory_id, None)
        path = MEMORY_DIR / f"{memory_id}.json"
        path.unlink(missing_ok=True)

    def delete_memories_for_bid(self, bid_id: str) -> int:
        """Delete all memories learned from a specific bid's analysis - used
        when a bid document is removed from history, so stale learnings from
        a deleted document stop being injected into future agent runs."""
        self._ensure_loaded()
        to_delete = [m for m in self._memories.values() if m["metadata"].get("source_bid_id") == bid_id]
        for memory in to_delete:
            self.delete_memory(memory["id"])
        return len(to_delete)


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z"


_manager: MemoryManager | None = None


def get_memory_manager() -> MemoryManager:
    global _manager
    if _manager is None:
        _manager = MemoryManager()
    return _manager


def _relevance_score(content: str, tags: list[str], document_text_lower: str) -> int:
    score = 0
    for word in content.lower().split():
        if len(word) > 4 and word in document_text_lower:
            score += 1
    for tag in tags:
        if tag.lower() in document_text_lower:
            score += 3
    return score


def _format_memories_as_context(memories: list[dict[str, Any]], agent: str) -> str:
    if not memories:
        return f"No previous learnings available for {agent} analysis."

    lines = [f"Based on {len(memories)} previous {agent} analyses:", ""]
    for i, memory in enumerate(memories, start=1):
        lines.append(f"{i}. {memory['content']}")
        tags = memory["metadata"].get("tags") or []
        if tags:
            lines.append(f"   Tags: {', '.join(tags)}")
        lines.append(f"   Used {memory['metadata']['usage_count']} times")
        lines.append("")
    return "\n".join(lines)


def inject_memory_context(system_prompt: str, agent: str, document_text: str | None = None) -> str:
    """Prepend relevant past-analysis learnings to a system prompt."""
    manager = get_memory_manager()
    memories = manager.get_memories_for_agent(agent, limit=10)

    if document_text and memories:
        document_text_lower = document_text.lower()
        memories.sort(
            key=lambda m: _relevance_score(m["content"], m["metadata"].get("tags") or [], document_text_lower),
            reverse=True,
        )
        memories = memories[:5]

    for memory in memories[:3]:
        manager.record_memory_usage(memory["id"])

    if not memories:
        return system_prompt

    context_text = _format_memories_as_context(memories, agent)
    return (
        f"{system_prompt}\n\n"
        f"## RELEVANT LEARNINGS FROM PREVIOUS ANALYSES\n{context_text}\n\n"
        "Use the above learnings to inform your analysis, but always prioritize the current "
        "document's specific requirements."
    )


def _extract_key_findings(response: str) -> str | None:
    sentences = [s.strip() for s in re.split(r"[.!?]+", response) if len(s.strip()) > 20]
    if not sentences:
        return None
    return ". ".join(sentences[:2])


def _generate_tags(agent: str, content: str) -> list[str]:
    tags = [agent]
    content_lower = content.lower()
    for keyword in _AGENT_KEYWORDS.get(agent, []):
        if keyword.lower() in content_lower:
            tags.append(keyword)
    return tags


def extract_and_save_memory(agent: str, response: str, bid_id: str, document_type: str) -> str:
    """Extract a learning from an agent's raw response and persist it."""
    key_findings = _extract_key_findings(response)
    if not key_findings:
        return ""

    now = _now_iso()
    memory = {
        "id": "",
        "type": _MEMORY_TYPE_BY_AGENT.get(agent, "general"),
        "agent": agent,
        "content": key_findings,
        "metadata": {
            "source_bid_id": bid_id,
            "source_document": document_type,
            "confidence": 0.85,
            "tags": _generate_tags(agent, key_findings),
            "created_at": now,
            "updated_at": now,
            "usage_count": 0,
            "last_used": now,
        },
    }
    get_memory_manager().save_memory(memory)
    return memory["id"]
