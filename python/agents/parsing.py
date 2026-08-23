"""Shared response parsing for the LLM-backed agents (legal/engineering/
accounting). Ported from the regex/JSON fallback logic in the TS agents so
all three agents parse responses the same way."""

from __future__ import annotations

import json
import re
from typing import Any


def parse_array(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item)]
    if isinstance(value, str):
        return [line for line in value.split("\n") if line.strip()]
    return []


def extract_json_block(content: str) -> dict[str, Any] | None:
    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def extract_bullet_points(text: str, section_keyword: str) -> list[str]:
    pattern = rf"{section_keyword}[^:]*:?\s*([\s\S]*?)(?:(?=[a-z]+[^:]*:|$))"
    match = re.search(pattern, text, re.IGNORECASE)
    if not match or not match.group(1):
        return []
    points = re.split(r"[\n•\-]", match.group(1))
    return [p.strip() for p in points if len(p.strip()) > 10 and "{" not in p]


def extract_rating_line(text: str, ratings: tuple[str, ...] = ("GREEN", "YELLOW", "RED")) -> str:
    pattern = rf"({'|'.join(ratings)})[^.]*\."
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(0)
    fallback = re.search(r"overall[^:]*:\s*([^.\n]+)", text, re.IGNORECASE)
    if fallback:
        return fallback.group(1)
    return "Assessment completed - please review details above"


CITATION_PATTERN = re.compile(r"\[p(?:age)?[:\s]*(\d+)(?:[,\s]+([^\]]+))?\]", re.IGNORECASE)


def strip_citation(item: str) -> str:
    return re.sub(r"\s*\[[^\]]*\]\s*$", "", item).strip()
