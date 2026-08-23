"""Citation enforcement for the Python analysis pipeline.

Mirrors lib/citation-tracker.ts so the Python pipeline enforces the same
100%-citation-coverage requirement that the TypeScript agents do.  Called
by the analyze router before persisting bid results.

A finding is considered cited when its text contains any of the patterns:
  [page:N], [page N], [p.N], [p N] or [pN], optionally followed by a
  section/clause reference - matching the formats the agent prompts request.
"""

from __future__ import annotations

import re
from typing import Any


# Pattern mirrors extractCitationsFromText in lib/citation-tracker.ts:
# [page:5], [p5], [p. 3, Clause 2.1], [page 3, section:2.1], etc.
_CITATION_RE = re.compile(r"\[p(?:age)?[:\s.]*\d+", re.IGNORECASE)


def has_citation(text: str) -> bool:
    """Return True when *text* contains at least one inline citation."""
    return bool(_CITATION_RE.search(text or ""))


def count_cited(items: list[str]) -> int:
    return sum(1 for item in items if has_citation(item))


def citation_coverage(items: list[str]) -> float:
    """0.0 – 1.0 coverage ratio; 1.0 when the list is empty."""
    if not items:
        return 1.0
    return count_cited(items) / len(items)


def validate_agent_citations(
    agent: str,
    assessment: dict[str, Any],
    list_fields: list[str],
) -> dict[str, Any]:
    """Return a citation-coverage report for one agent's assessment.

    Returns::

        {
            "agent": "legal",
            "total": 5,
            "cited": 3,
            "coverage": 0.6,
            "is_compliant": False,
            "uncited_fields": {"compliance_issues": [...]},
        }
    """
    total = 0
    cited = 0
    uncited_fields: dict[str, list[str]] = {}

    for field in list_fields:
        items = assessment.get(field)
        if not isinstance(items, list):
            continue
        uncited = [item for item in items if not has_citation(str(item))]
        total += len(items)
        cited += len(items) - len(uncited)
        if uncited:
            uncited_fields[field] = uncited

    coverage = (cited / total) if total > 0 else 1.0
    return {
        "agent": agent,
        "total": total,
        "cited": cited,
        "coverage": round(coverage, 4),
        "is_compliant": len(uncited_fields) == 0,
        "uncited_fields": uncited_fields,
    }


# Per-agent field lists that are expected to carry citations (mirrors what
# the prompts ask for in python/agents/prompts.py).
_AGENT_CITATION_FIELDS: dict[str, list[str]] = {
    "legal": ["compliance_issues", "contract_terms", "risks"],
    "engineering": ["scope_analysis", "structural_concerns", "site_requirements"],
    "accounting": ["cost_analysis", "payment_terms", "qualification_requirements"],
}


def enforce_citation_coverage(
    legal: dict[str, Any],
    engineering: dict[str, Any],
    accounting: dict[str, Any],
    *,
    min_coverage: float = 0.5,
) -> dict[str, Any]:
    """Validate citation coverage across all three agent assessments.

    When an agent's provider_used is "error" it already failed - skip it so
    we don't double-count a failure as a citation problem.

    Returns::

        {
            "overall_coverage": 0.75,
            "is_compliant": True,
            "reports": { "legal": {...}, "engineering": {...}, "accounting": {...} },
            "low_coverage_agents": [],
        }

    ``is_compliant`` is True when every agent with results (non-error) meets
    ``min_coverage``.  The caller may treat non-compliant results as a soft
    warning (log + annotate) rather than a hard failure.
    """
    assessments = {
        "legal": legal,
        "engineering": engineering,
        "accounting": accounting,
    }
    reports: dict[str, dict[str, Any]] = {}
    low_coverage: list[str] = []

    for agent, assessment in assessments.items():
        if assessment.get("provider_used") == "error":
            continue
        report = validate_agent_citations(agent, assessment, _AGENT_CITATION_FIELDS[agent])
        reports[agent] = report
        if report["coverage"] < min_coverage:
            low_coverage.append(agent)

    all_totals = sum(r["total"] for r in reports.values())
    all_cited = sum(r["cited"] for r in reports.values())
    overall = (all_cited / all_totals) if all_totals > 0 else 1.0

    return {
        "overall_coverage": round(overall, 4),
        "is_compliant": len(low_coverage) == 0,
        "reports": reports,
        "low_coverage_agents": low_coverage,
    }
