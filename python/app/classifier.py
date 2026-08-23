"""Keyword-based document classification. Ported from lib/classifier.ts."""

from __future__ import annotations

import re

DOC_TYPES = ["CONTRACT", "SPECIFICATION", "BOQ", "DRAWING", "ADDENDUM"]

KEYWORDS: dict[str, list[str]] = {
    "CONTRACT": [
        "agreement",
        "contract",
        "terms and conditions",
        "scope of work",
        "payment",
        "parties",
        "hereinafter",
    ],
    "SPECIFICATION": [
        "specification",
        "specifications",
        "shall be",
        "requirements",
        "material",
        "dimensions",
        "standard",
        "quality",
    ],
    "BOQ": [
        "bill of quantities",
        "boq",
        "rate",
        "unit price",
        "quantity",
        "total cost",
        "item",
        "description",
    ],
    "DRAWING": [
        "drawing",
        "plan",
        "section",
        "elevation",
        "scale",
        "dimension",
        "detail",
        "architectural",
        "structural",
        "layout",
    ],
    "ADDENDUM": [
        "addendum",
        "amendment",
        "modification",
        "change order",
        "revision",
        "supplement",
    ],
}


def classify_document(text: str) -> dict:
    lower_text = text.lower()

    scores = {doc_type: 0 for doc_type in DOC_TYPES}
    for doc_type, keyword_list in KEYWORDS.items():
        for keyword in keyword_list:
            pattern = rf"\b{re.escape(keyword)}\b"
            scores[doc_type] += len(re.findall(pattern, lower_text, re.IGNORECASE))

    max_score = max(scores.values())
    normalized = {
        doc_type: (score / max_score if max_score > 0 else 0) for doc_type, score in scores.items()
    }

    top_doc_type = "CONTRACT"
    top_score = normalized["CONTRACT"]
    for doc_type, score in normalized.items():
        if score > top_score:
            top_score = score
            top_doc_type = doc_type

    if top_score < 0.3:
        return {"doc_type": "CONTRACT", "confidence": 0.4}

    return {"doc_type": top_doc_type, "confidence": min(top_score, 0.95)}
