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

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from agents.tracing import configure_tracing, tracing_enabled
from app import db
from app.routers import admin_boq, admin_models, analyze, bid_detail, bids, company_context, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
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
