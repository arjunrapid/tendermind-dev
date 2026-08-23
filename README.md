# Tendermind

An AI bid/no-bid advisor for construction tenders. Upload tender documents, and a
pipeline of specialised agents classifies them, extracts contract terms with
citations, computes deterministic pricing exposure, and returns a bid
recommendation.

## Features

### Core Functionality
- **📄 PDF Document Upload** - Drag-and-drop upload with real text extraction
  (`pdf-parse`). Scanned PDFs without OCR are rejected with an explicit error.
- **🏷️ Document Classification** - Automatically identifies document types:
  - Contracts
  - Specifications
  - Bills of Quantities (BOQ)
  - Engineering Drawings
  - Addendums/Amendments

- **⚖️ Multi-Agent Analysis** - Specialised agents analyse documents:
  - **Legal Agent** - LD caps, retention, termination, warranty, indemnity, arbitration
  - **Engineering Agent** - Scope, timeline, site conditions, drawing classification
  - **Accounting Agent** - Cost analysis, payment terms, qualification requirements, cash flow
  - **Risk Agent** - Deterministic aggregation of the three assessments into a verdict

- **🔎 Citation Enforcement** - Extracted facts must carry a source citation
  (`[page:5, section:Art. 6.2]`); coverage is validated per agent.

- **💰 Deterministic Pricing** - LD exposure, performance security, and retention
  lock-up computed with fixed arithmetic (no LLM), using terms extracted from
  the document where available.

- **🧠 Company Knowledge** - pgvector-backed retrieval of prior bid assessments,
  so analyses draw on the company's own history.

- **📊 Bid History** - Track and review all analysed documents with full audit trail.

- **🔐 Role-gated UI** - `admin` and `analyst` roles. ⚠️ The login is a
  **demo only**: credentials and session live in client-side `localStorage`
  (`lib/auth.tsx`). It is not real authentication and must be replaced before
  any production use.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Analysis backend | Python 3, FastAPI, LangGraph, LangSmith |
| TypeScript backend | Next.js route handlers (upload, bids, BOQ) |
| Database | Postgres + pgvector (Neon / Vercel Postgres) |
| Storage | Vercel Blob |

## Architecture

The project is **mid-migration** from a TypeScript agent pipeline to a
Python/LangGraph one. Both are present:

- `python/` — the **live** analysis pipeline. LangGraph nodes for orchestrator,
  legal, engineering, accounting, and risk; LangSmith tracing; pgvector
  retrieval; per-agent model selection.
- `lib/agents/` — the earlier TypeScript implementation. Still exercised by the
  root `test-*.ts` scripts, but **not on the request path** for analysis.

`POST /api/analyze` in Next.js is a thin proxy to the Python service. See
[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for the route-by-route
migration table.

## Getting Started

Analysis requires **both** servers running.

### 1. Environment

No env template is committed (`.env*` is gitignored). Create `.env.local` with
at minimum:

```env
DATABASE_URL=postgresql://...        # Postgres with the pgvector extension
OPENROUTER_API_KEY=your_key_here     # or another provider - see below
PYTHON_BACKEND_URL=http://localhost:8000
```

Full variable lists: `ENV_VAR_DOCS` in [lib/llm/config.ts](./lib/llm/config.ts)
for the TypeScript side, and [python/models/factory.py](./python/models/factory.py)
for the Python side.

⚠️ **`DATABASE_URL` only helps the Python backend locally.** `lib/db.ts` uses
`@vercel/postgres`'s `sql` tag, which is hardcoded to Neon's HTTP proxy
protocol and refuses plain TCP connections outright (verified:
`"Error connecting to database: fetch failed"` against a real local Postgres).
So `upload`, `bids`, `bid/[id]`, and `admin/boq` need an actual Neon or Vercel
Postgres instance even for local dev — a local Postgres will not work for them.

**No Docker or Homebrew? Get a real local Postgres + pgvector anyway** — for
the Python side only, per the above:

```bash
scripts/local-postgres.sh start
export DATABASE_URL=$(scripts/local-postgres.sh uri)
```

This installs [`uv`](https://astral.sh/uv) (no sudo) and uses the `pgserver`
PyPI package to run a real, prebuilt Postgres 16 + pgvector 0.6.2. Verified
working this session — `python/app/main.py` boots against it, creates all six
tables, and a full `/api/analyze` run persisted and read back correctly. See
the script's header comment and [DEPLOYMENT.md](./DEPLOYMENT.md) for detail.

### 2. Frontend

```bash
npm install
npm run dev
```

→ http://localhost:3000

### 3. Python backend

```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/api/health`

Without this running, uploads succeed but `/api/analyze` returns a connection error.

## LLM Providers

Provider selection is configuration, not code.

**Python backend** (`python/models/factory.py`) — `openai`, `google`,
`anthropic`, `openrouter`, `moonshot`. Defaults to `DEFAULT_LLM_PROVIDER`
(`anthropic` if unset). Per-agent overrides via `/api/admin/models`.

**TypeScript** (`lib/llm/`) — `openrouter` (default), `tokenrouter`,
`anthropic`, with automatic failover to any other provider that has a key set.

## Project Structure

```
app/
├── page.tsx                    # Upload interface
├── login/page.tsx              # Demo login
├── bids/page.tsx               # Bid history
├── bid/[id]/page.tsx           # Bid details
├── admin/                      # BOQ defaults, model config, company context
└── api/                        # Route handlers (some proxy to Python)

components/                     # AppShell, UploadForm, ResultsView,
                                # PdfViewer, ProcessProgress, StatCard

lib/
├── agents/                     # Legacy TS agents (legal, engineering,
│                               #   accounting, risk) + unused mock-agents.ts
├── llm/                        # Provider abstraction + factory
├── memory/                     # File-based agent memory (store shared with Python)
├── citation-tracker.ts         # Citation extraction and validation
├── pricing-engine.ts           # Deterministic pricing (no LLM)
├── classifier.ts               # Document classification
├── db.ts                       # Postgres schema and queries
└── pdf.ts                      # PDF text extraction

python/
├── app/                        # FastAPI routers, db, knowledge, embeddings
├── agents/                     # Prompts, nodes, orchestrator, tracing
├── graph/pipeline.py           # LangGraph pipeline
└── models/factory.py           # Multi-provider chat model factory

test-*.ts                       # Scenario scripts for the TS pipeline
sample-tenders/                 # Sample tender documents
```

## API Endpoints

| Endpoint | Handled by |
|---|---|
| `POST /api/upload` | Next.js |
| `POST /api/analyze` | Proxy → Python |
| `GET /api/bids` | Next.js |
| `GET/DELETE /api/bid/[id]` | Next.js |
| `GET/POST /api/admin/boq` | Next.js |
| `GET/POST /api/admin/models` | Proxy → Python |
| `/api/company-context` | Proxy → Python |
| `GET /api/health` | Python only |

## Database

Postgres, with tables created automatically on first use.

- TypeScript (`lib/db.ts`): `bids`, `extracted_clauses`, `boq_defaults`
- Python: additionally requires the **pgvector** extension for company-knowledge
  embeddings

## Testing

The root `test-*.ts` scripts exercise the **TypeScript** pipeline, not the live
Python one. There is no `test` script in `package.json` and no TS runner is
declared as a dependency, so run them ad hoc:

```bash
npx tsx test-pricing-engine.ts
```

## Documentation

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - current state and remaining work
- [AGENTS_COMPLETE_GUIDE.md](./AGENTS_COMPLETE_GUIDE.md) - agent architecture
- [MEMORY_SYSTEM_GUIDE.md](./MEMORY_SYSTEM_GUIDE.md) - agent memory
- [LEGAL_AGENT_GUIDE.md](./LEGAL_AGENT_GUIDE.md) - legal agent detail
- [TENDER_ASSISTANT.md](./TENDER_ASSISTANT.md) - product behaviour
- [DEPLOYMENT.md](./DEPLOYMENT.md) - deployment
- [python/README.md](./python/README.md) - Python backend

## License

MIT License
