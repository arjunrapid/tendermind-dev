"""FastAPI app - replaces the Next.js API routes under app/api/*.

Route-for-route mapping:
  app/api/upload/route.ts      -> app/routers/upload.py       (POST /api/upload)
  app/api/analyze/route.ts     -> app/routers/analyze.py      (POST /api/analyze)
  app/api/bids/route.ts        -> app/routers/bids.py         (GET  /api/bids)
  app/api/bid/[id]/route.ts    -> app/routers/bid_detail.py   (GET/DELETE /api/bid/{id})
  app/api/admin/boq/route.ts   -> app/routers/admin_boq.py    (GET/POST /api/admin/boq)
  (new, no TS equivalent)      -> app/routers/admin_models.py (GET/POST /api/admin/models)
  (new, no TS equivalent)      -> app/routers/company_context.py (GET/POST /api/company-context, DELETE /api/company-context/{id})

Run with: uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

if not os.environ.get("SSL_CERT_FILE"):
    try:
        import certifi

        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass

from agents.tracing import configure_tracing, tracing_enabled
from app import db
from app.routers import admin_boq, admin_models, analyze, auth, bid_detail, bids, company_context, upload

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Env validation — fail fast with clear errors rather than silent runtime
# failures deep inside a request handler.
# ---------------------------------------------------------------------------

def _validate_env() -> None:
    """Raise on startup when any required environment variable is missing."""
    required: list[tuple[str, str]] = [
        ("DATABASE_URL", "Postgres connection string (Neon/Vercel Postgres)"),
        ("JWT_SECRET", "Long random secret for signing JWTs (e.g. openssl rand -hex 32)"),
    ]
    missing = [(name, desc) for name, desc in required if not os.environ.get(name)]
    if missing:
        lines = "\n".join(f"  {name}: {desc}" for name, desc in missing)
        raise RuntimeError(
            f"Missing required environment variables:\n{lines}\n"
            "Set them in your .env file or environment before starting the server."
        )

    # Warn about missing model provider keys so operators see actionable
    # messages rather than cryptic API errors mid-analysis.
    provider_keys = {
        "ANTHROPIC_API_KEY": "Anthropic (Claude)",
        "OPENAI_API_KEY": "OpenAI",
        "OPENROUTER_API_KEY": "OpenRouter",
        "GOOGLE_API_KEY": "Google Gemini",
    }
    present = [name for name in provider_keys if os.environ.get(name)]
    if not present:
        logger.warning(
            "No LLM provider API keys found (%s). Analysis will fail without at least one.",
            ", ".join(provider_keys),
        )
    else:
        logger.info("LLM provider keys present: %s", ", ".join(present))


@asynccontextmanager
async def lifespan(app: FastAPI):
    _validate_env()
    configure_tracing()
    await db.init_pool()
    yield
    await db.close_pool()


app = FastAPI(title="Tendermind API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request correlation IDs
# ---------------------------------------------------------------------------

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """Attach a correlation ID to every request/response so the Next.js
    proxy layer and Python backend traces can be linked in logs and
    monitoring tools. Reads X-Request-ID from the incoming request (set by
    the Next.js proxy) and echoes it back; generates a new UUID when absent."""
    correlation_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled error [correlation_id=%s]", correlation_id)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"}, headers={"X-Request-ID": correlation_id})
    response.headers["X-Request-ID"] = correlation_id
    return response


app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(bids.router)
app.include_router(bid_detail.router)
app.include_router(admin_boq.router)
app.include_router(admin_models.router)
app.include_router(company_context.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "tracing_enabled": tracing_enabled()}
