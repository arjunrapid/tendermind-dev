"""Unit tests for app.citations - citation coverage enforcement."""

import pytest
from app.citations import (
    citation_coverage,
    enforce_citation_coverage,
    has_citation,
    validate_agent_citations,
)


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Payment due in 30 days [page:5, section:2.1]", True),
        ("Risk of delay [p5]", True),
        ("Retention of 5% [page 3, Clause 2]", True),
        ("No citation here", False),
        ("", False),
    ],
)
def test_has_citation(text, expected):
    assert has_citation(text) == expected


def test_citation_coverage_empty():
    assert citation_coverage([]) == 1.0


def test_citation_coverage_all_cited():
    items = ["Term A [page:1]", "Term B [page:2]"]
    assert citation_coverage(items) == 1.0


def test_citation_coverage_partial():
    items = ["Term A [page:1]", "Term B - no citation"]
    assert citation_coverage(items) == 0.5


def test_validate_agent_citations():
    assessment = {
        "compliance_issues": ["Issue A [page:1]", "Issue B no citation"],
        "contract_terms": ["Term X [page:2]"],
        "risks": [],
    }
    report = validate_agent_citations("legal", assessment, ["compliance_issues", "contract_terms", "risks"])
    assert report["total"] == 3
    assert report["cited"] == 2
    assert not report["is_compliant"]
    assert "compliance_issues" in report["uncited_fields"]


def test_enforce_citation_coverage_all_compliant():
    def _make(items):
        return {"compliance_issues": items, "contract_terms": [], "risks": [], "provider_used": "anthropic"}

    legal = _make(["A [page:1]", "B [page:2]"])
    engineering = {
        "scope_analysis": ["S [page:1]"],
        "structural_concerns": [],
        "site_requirements": [],
        "provider_used": "anthropic",
    }
    accounting = {
        "cost_analysis": ["C [page:3]"],
        "payment_terms": [],
        "qualification_requirements": [],
        "provider_used": "anthropic",
    }
    result = enforce_citation_coverage(legal, engineering, accounting, min_coverage=0.5)
    assert result["is_compliant"]
    assert result["low_coverage_agents"] == []


def test_enforce_citation_coverage_skips_error_agents():
    legal = {"compliance_issues": [], "contract_terms": [], "risks": [], "provider_used": "error"}
    engineering = {
        "scope_analysis": ["No citation"],
        "structural_concerns": [],
        "site_requirements": [],
        "provider_used": "anthropic",
    }
    accounting = {
        "cost_analysis": [],
        "payment_terms": [],
        "qualification_requirements": [],
        "provider_used": "anthropic",
    }
    result = enforce_citation_coverage(legal, engineering, accounting)
    # legal is skipped (error); engineering has 1 uncited item but coverage = 0/1 = 0 < threshold
    assert "legal" not in result["reports"]
