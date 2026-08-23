"""
Reusable document-extraction tool.

Text extraction from a PDF is a deterministic, mechanical operation - it
should never be something an LLM agent "does" by reading raw bytes or
guessing at content. This module wraps the deterministic extractor
(`app.pdf_extract`) as a single LangChain tool, `extract_document_text`,
that every agent shares: the agent calls the tool, the tool returns exactly
what `pypdf` extracted, and the agent reasons over that - it never parses
the PDF itself.

A small on-disk `DocumentStore` sits in front of it so agents can refer to
an uploaded document by a short `document_id` instead of the tool call
needing to carry the full file bytes as an argument.
"""

from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

from langchain_core.tools import tool

from app.company_context import get_context_for_category
from app.document_sections import filter_text_for_domain
from app.pdf_extract import extract_text_from_file

_STORE_DIR = Path(tempfile.gettempdir()) / "tendermind_documents"


class DocumentStore:
    """Persists uploaded file bytes to disk, keyed by a short id, so tools
    (and any agent) can look them up by reference instead of passing raw
    bytes around."""

    def __init__(self, base_dir: Path = _STORE_DIR) -> None:
        self._base_dir = base_dir
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, file_name: str) -> str:
        document_id = uuid.uuid4().hex
        path = self._path_for(document_id, file_name)
        path.write_bytes(data)
        return document_id

    def load(self, document_id: str) -> tuple[bytes, str]:
        matches = list(self._base_dir.glob(f"{document_id}__*"))
        if not matches:
            raise FileNotFoundError(f"No stored document with id '{document_id}'")
        path = matches[0]
        file_name = path.name.split("__", 1)[1]
        return path.read_bytes(), file_name

    def _path_for(self, document_id: str, file_name: str) -> Path:
        return self._base_dir / f"{document_id}__{file_name}"


_store: DocumentStore | None = None


def get_document_store() -> DocumentStore:
    global _store
    if _store is None:
        _store = DocumentStore()
    return _store


@tool
def extract_document_text(document_id: str) -> str:
    """Extract the full text of a previously uploaded document.

    Args:
        document_id: the id returned when the document was uploaded/stored.

    Returns:
        The document's extracted plain text (deterministic - no LLM
        involved). Raises if no document with that id exists, or if a PDF
        has no extractable text (e.g. a scanned image without OCR).
    """
    data, file_name = get_document_store().load(document_id)
    return extract_text_from_file(data, file_name)


# The set of tools every domain agent (legal/engineering/accounting) is
# given, so extraction stays a shared, reusable capability rather than each
# agent needing its own copy.
DOCUMENT_TOOLS = [extract_document_text]


def document_tools_for_domain(domain: str) -> list:
    """Domain-scoped variant of DOCUMENT_TOOLS: filtering by domain
    (app.document_sections) happens inside the tool call itself - still a
    deterministic, mechanical step, not something left to the LLM's
    judgment - so the legal agent's tool call returns only legal-relevant
    paragraphs, the engineering agent's only engineering ones, etc., even
    though both call a tool named identically from the agent's point of
    view (`extract_document_text`), matching the shared prompt instructions
    in `tool_user_message_for`."""

    @tool("extract_document_text")
    def _extract_document_text_for_domain(document_id: str) -> str:
        """Extract this document's text relevant to your area of analysis.

        Args:
            document_id: the id returned when the document was uploaded/stored.

        Returns:
            The subset of the document's extracted plain text relevant to
            your specialty (deterministic - no LLM involved). Raises if no
            document with that id exists, or if a PDF has no extractable
            text (e.g. a scanned image without OCR).
        """
        data, file_name = get_document_store().load(document_id)
        full_text = extract_text_from_file(data, file_name)
        return filter_text_for_domain(full_text, domain)

    return [_extract_document_text_for_domain]


def company_context_tool_for_domain(domain: str) -> list:
    """Tool wrapper around app.company_context.get_context_for_category -
    a plain Postgres SELECT, same deterministic-tool-call shape as
    document_tools_for_domain above rather than the context being baked
    into the system prompt ahead of time. The agent decides when (and
    whether) to call it, but the lookup itself involves no LLM: same
    content every time for a given domain, straight from the DB."""

    @tool("get_company_context")
    async def _get_company_context() -> str:
        """Fetch the company's curated reference material for your domain
        (policies, standards, or practices an admin has uploaded via the
        Company Context page), if any exists. Call this once before
        finalizing your analysis so company-specific guidance can override
        generic assumptions.

        Returns:
            The curated company context for your domain (deterministic - no
            LLM involved), or a note that none has been uploaded yet.
        """
        context = await get_context_for_category(domain)
        return context or f"No company-specific {domain} context has been uploaded yet."

    return [_get_company_context]
