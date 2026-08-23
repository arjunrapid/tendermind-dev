"""
CLI entrypoint: run the parallel legal/engineering/accounting/risk pipeline
over a text file.

    python run_analysis.py path/to/document.txt --doc-type CONTRACT --provider anthropic

Prints the final state (all four assessments) as JSON.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv

from agents.tracing import configure_tracing
from graph.pipeline import run_pipeline

load_dotenv()


async def main() -> None:
    configure_tracing()

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("document", type=Path, help="Path to a text file to analyze")
    parser.add_argument("--doc-type", default="CONTRACT")
    parser.add_argument("--provider", default=None, help="openai | google | anthropic | openrouter | moonshot")
    parser.add_argument("--model", default=None, help="Override the provider's default model")
    args = parser.parse_args()

    document_text = args.document.read_text()
    bid_id = str(uuid.uuid4())

    start = time.perf_counter()
    result = await run_pipeline(
        document_text,
        args.doc_type,
        bid_id,
        provider=args.provider,
        model=args.model,
    )
    elapsed = time.perf_counter() - start

    output = {
        "bid_id": bid_id,
        "elapsed_seconds": round(elapsed, 2),
        "legal": result.get("legal"),
        "engineering": result.get("engineering"),
        "accounting": result.get("accounting"),
        "risk": result.get("risk"),
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(130)
