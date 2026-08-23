# Tendermind Runtime Architecture

## Overview

Tendermind is a two-tier application:

| Tier | Technology | Responsibility |
|------|-----------|----------------|
| **Frontend / proxy** | Next.js 16 (Node.js) | UI, auth session state, thin HTTP proxies to the Python service |
| **Backend / analysis** | Python 3.11 + FastAPI | All business logic: PDF extraction, LLM agent orchestration, DB access |

The Next.js app has **no direct database access** and **no LLM calls** — it is purely a UI and a proxy layer. All functionality lives in the Python service.

---

## Component Map

```
Browser
  └─ Next.js (app/ + components/)
       ├─ /app/login             login page → POST /api/auth/login
       ├─ /app/(pages)           AppShell (JWT in localStorage → Authorization header)
       └─ /app/api/*             Thin proxies (forward Authorization + X-Request-ID)
            ├─ /api/auth/[...path]  → Python /api/auth/*
            ├─ /api/upload          → Python /api/upload
            ├─ /api/analyze         → Python /api/analyze
            ├─ /api/bids            → Python /api/bids
            ├─ /api/bid/[id]        → Python /api/bid/{id}
            ├─ /api/admin/boq       → Python /api/admin/boq
            ├─ /api/admin/models    → Python /api/admin/models
            └─ /api/company-context → Python /api/company-context

Python FastAPI (python/)
  ├─ app/main.py            startup: env validation, DB pool, correlation ID middleware
  ├─ app/routers/
  │    ├─ auth.py           POST /api/auth/login, GET /api/auth/me
  │    ├─ upload.py         PDF/text ingestion, document store, size validation
  │    ├─ analyze.py        LangGraph pipeline orchestration, citation/validation, persist
  │    ├─ bids.py           bid list query
  │    ├─ bid_detail.py     bid fetch + delete (cascades agent memories)
  │    ├─ admin_boq.py      BOQ defaults (admin JWT required)
  │    ├─ admin_models.py   per-agent LLM provider overrides (admin JWT required)
  │    └─ company_context.py curated reference material (admin JWT for writes)
  ├─ app/auth.py            JWT creation, bcrypt verify, FastAPI Depends aliases
  ├─ app/citations.py       citation coverage enforcement (M2a)
  ├─ app/validation.py      pre-persist bid result checks (M2b)
  ├─ app/knowledge.py       pgvector retrieval with threshold + dedup + budget (M3a/M3b)
  ├─ app/db.py              asyncpg pool, schema init, all DB operations
  ├─ graph/pipeline.py      LangGraph fan-out: orchestrator → legal/engineering/accounting → risk
  └─ agents/
       ├─ orchestrator.py   document routing (splits full doc into per-domain excerpts)
       ├─ nodes.py          legal / engineering / accounting LLM agents
       ├─ risk.py           deterministic risk aggregator (no LLM)
       └─ tools.py          extract_document_text, get_company_context tools
```

---

## Authentication Flow

```
Browser                  Next.js                  Python
  │ POST /api/auth/login   │                          │
  │──────────────────────>│                          │
  │                        │ POST /api/auth/login     │
  │                        │─────────────────────────>│
  │                        │    { access_token, user } │
  │                        │<─────────────────────────│
  │  { access_token, user }│                          │
  │<──────────────────────│                          │
  │                        │                          │
  │ (stores token in       │                          │
  │  localStorage)         │                          │
  │                        │                          │
  │ GET /api/bids          │                          │
  │ Authorization: ****** │                         │
  │──────────────────────>│                          │
  │                        │ GET /api/bids            │
  │                        │ Authorization: ******  │
  │                        │─────────────────────────>│
  │                        │    (JWT verified here)   │
  │                        │<─────────────────────────│
  │<──────────────────────│                          │
```

- JWT is signed with `JWT_SECRET` (HS256, 8-hour expiry by default).
- All routes except `/api/auth/login` and `/api/health` require a valid JWT (`CurrentUser` Depends).
- `/api/admin/*` and `/api/company-context` writes additionally require `role=admin` in the JWT (`AdminUser` Depends, enforced in Python, not just UI).

---

## Environment Variables

### Required on startup (Python will refuse to start without these)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string (Neon / Vercel Postgres) |
| `JWT_SECRET` | Long random secret for signing JWTs (`openssl rand -hex 32`) |

### At least one LLM provider key required

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `OPENAI_API_KEY` | OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter |
| `GOOGLE_API_KEY` | Google Gemini |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTHON_BACKEND_URL` | `http://localhost:8000` | URL of the Python service as seen by Next.js |
| `DEFAULT_LLM_PROVIDER` | `anthropic` | Provider used when no agent override is set |
| `JWT_EXPIRY_SECONDS` | `28800` (8 h) | JWT token lifetime |
| `AUTH_ADMIN_PASSWORD` | `tmadmin123` | Password for the seeded `tmadmin` account |
| `AUTH_ANALYST_PASSWORD` | `tmanalyst123` | Password for the seeded `tmanalyst` account |
| `LANGSMITH_API_KEY` | *(unset)* | Enables LangSmith tracing |
| `LANGCHAIN_PROJECT` | *(unset)* | LangSmith project name |

---

## Running Locally

```bash
# 1. Python service
cd python
pip install -r requirements.txt
cp ../.env.example .env  # set DATABASE_URL, JWT_SECRET, and an LLM key
uvicorn app.main:app --reload --port 8000

# 2. Next.js frontend (separate terminal)
cd ..
npm install
npm run dev
```

---

## Analysis Pipeline

```
Upload (POST /api/upload)
  → extract text + store in DocumentStore → return { extractedText, documentId }

Analyze (POST /api/analyze)
  → classify document type
  → orchestrator agent: split document into legal/engineering/accounting excerpts
  ↓ (concurrent)
  ├─ legal agent     → compliance, contract terms, risks (with company context + knowledge retrieval)
  ├─ engineering agent → scope, structural, feasibility
  └─ accounting agent  → costs, payment terms, cash flow
  ↓ (join)
  → risk agent (deterministic): aggregate → risk_score, bid_decision
  → pricing engine (deterministic): LD cap, performance security, lockup
  → bid strategy (deterministic): margin, recommended price
  → citation enforcement: coverage check per agent
  → pre-persist validation: coherence checks, escalate to MANUAL_REVIEW on errors
  → save to DB
  → index knowledge chunks (pgvector, async, best-effort)
  → return full result + analysisProvenance
```

---

## Correlation IDs

Every HTTP request is assigned an `X-Request-ID` header:
- If the client sends `X-Request-ID`, it is used as-is.
- Otherwise a UUID is generated.
- The ID is forwarded from Next.js to Python and echoed back in the response.
- Logs in both tiers include the correlation ID, making cross-service traces easy to find.

---

## Runbooks

### Provider outage
1. Check which provider is failing via `analysisProvenance.providers` in a recent bid.
2. Switch the affected agents to a working provider in the Model Management page (`/admin/models`).
3. Re-run the analysis.

### DB connection issues
1. Check `DATABASE_URL` is correct and the Neon/Vercel Postgres service is reachable.
2. Restart the Python service (`uvicorn app.main:app --reload --port 8000`).
3. The pool is re-created on startup; no manual DB reconnection is needed.

### Empty / invalid extraction (422 from upload)
1. Confirm the PDF is text-based, not a scanned image.
2. For scanned PDFs, run OCR pre-processing (e.g. `ocrmypdf`) before uploading.
3. Check file size is under 50 MB.

### Degraded retrieval (low citation coverage)
1. `analysisProvenance.citation_coverage.low_coverage_agents` lists which agents had low coverage.
2. This is a warning, not a failure — the bid is still persisted.
3. Consider switching to a model with better instruction-following for the affected agent.

### Manual review escalation
- `bid_decision = "MANUAL_REVIEW"` means either an agent failed (`failed_agents` non-empty) or validation detected an incoherent result.
- Check `bidRecommendation.validation.errors` for the specific codes.
- Re-run analysis or send the tender to a human reviewer.
