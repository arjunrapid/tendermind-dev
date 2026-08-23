# Tendermind - Quick Start Guide

## 🚀 Get Running Locally

Analysis needs **two servers**: the Next.js frontend and the Python analysis
backend. Uploads work without the Python server; `/api/analyze` does not.

### 1. Environment

No env template is committed (`.env*` is gitignored). Create `.env.local`:

```env
DATABASE_URL=postgresql://...        # Postgres with the pgvector extension
OPENROUTER_API_KEY=your_key_here     # or ANTHROPIC_API_KEY / OPENAI_API_KEY / etc.
PYTHON_BACKEND_URL=http://localhost:8000
```

Full variable lists live in `ENV_VAR_DOCS` in `lib/llm/config.ts` (TypeScript)
and `python/models/factory.py` (Python).

**No Postgres handy, and no Docker or Homebrew either?**

```bash
scripts/local-postgres.sh start
export DATABASE_URL=$(scripts/local-postgres.sh uri)
```

Gets a real Postgres 16 + pgvector 0.6.2 running locally with no sudo (via
`uv` + the `pgserver` PyPI package). Verified this session: the Python backend
boots against it, creates all its tables, and a full analyze run persists and
reads back correctly.

⚠️ This only helps the **Python** backend. `lib/db.ts` (`upload`, `bids`,
`bid/[id]`, `admin/boq`) uses `@vercel/postgres`'s `sql` tag, which is
hardcoded to Neon's HTTP proxy and refuses plain TCP — confirmed with
`"Error connecting to database: fetch failed"` against this same local
Postgres. Those routes need a real Neon or Vercel Postgres instance even for
local dev.

### 2. Frontend

```bash
npm install
npm run dev
# → http://localhost:3000
```

### 3. Python backend

```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/api/health`

## 📋 What You Get

✅ **Full web app** - Upload, analyse, track bids
✅ **Multi-agent analysis** - Legal, Engineering, Accounting, Risk
✅ **Real LLM calls** - LangGraph pipeline with LangSmith tracing
✅ **Citation enforcement** - Facts must cite page/section
✅ **Deterministic pricing** - LD, security, and retention exposure, no LLM
✅ **Company knowledge** - pgvector retrieval over prior bids
✅ **Smart classification** - 5 document types
✅ **Responsive design** - Mobile and desktop

## 🧪 Test It

1. Navigate to http://localhost:3000
2. Log in with a demo account (see `lib/auth.tsx` - `admin` and `analyst` roles).
   ⚠️ This is `localStorage`-only demo auth, not real authentication.
3. Click the upload area or drag a PDF. Scanned PDFs without OCR will be
   rejected - the extractor needs a real text layer.
4. The system produces:
   - Document classification
   - Legal assessment (LD, retention, termination, indemnity, arbitration)
   - Engineering assessment (scope, timeline, site conditions)
   - Accounting assessment (costs, payment terms, qualifications, cash flow)
   - Deterministic pricing breakdown
   - Risk score and bid recommendation
5. View bid history at `/bids`, admin settings at `/admin`

Sample documents are in `sample-tenders/`.

## 📚 Architecture

```
User Upload (PDF)
      ↓
POST /api/upload  (Next.js → Vercel Blob + Postgres)
      ↓
Text Extraction (pdf-parse, real extraction)
      ↓
POST /api/analyze (Next.js) ── thin proxy ──▶ Python FastAPI :8000
                                                    ↓
                                          LangGraph pipeline
                                          orchestrator → legal ┐
                                                         eng   ├→ risk
                                                         acct  ┘
                                          + pgvector knowledge retrieval
                                          + LangSmith tracing
                                                    ↓
                                          Deterministic pricing
                                                    ↓
                                          Bid recommendation
      ↓
Database Storage (Postgres)
      ↓
History & Details Pages
```

The TypeScript agents in `lib/agents/` are the **previous** implementation. They
still work and are covered by the root `test-*.ts` scripts, but the running app
does not use them.

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Analysis backend | Python + FastAPI + LangGraph + LangSmith |
| TypeScript backend | Next.js route handlers |
| Database | Postgres + pgvector |
| Storage | Vercel Blob |

## 📦 File Structure

```
48 TypeScript/TSX files
35 Python files
8 Next.js API routes (3 proxy to Python)
7 FastAPI routers
6 React components
4 TS agents (legacy) + 5 LangGraph nodes (live)
7 test scripts
```

## 🤖 LLM Providers

Provider choice is configuration, not code.

- **Python** (`python/models/factory.py`): `openai`, `google`, `anthropic`,
  `openrouter`, `moonshot`. Falls back to `DEFAULT_LLM_PROVIDER` (`anthropic`
  if unset). Per-agent overrides at `/admin/models`.
- **TypeScript** (`lib/llm/`): `openrouter` (default), `tokenrouter`,
  `anthropic`, with automatic failover.

## 🧪 Running the Test Scripts

These exercise the **TypeScript** pipeline only. There is no `test` script in
`package.json` and no TS runner is a declared dependency:

```bash
npx tsx test-pricing-engine.ts
```

Available: `test-pricing-engine.ts`, `test-reference-tender.ts`,
`test-tender-strong-bid.ts`, `test-tender-moderate-risk.ts`,
`test-tender-high-risk.ts`, `test-legal-agent.ts`.

## 🚀 Next Steps

1. **Finish the backend migration** - `upload`, `bids`, `bid/[id]`, and
   `admin/boq` still run in TypeScript (see IMPLEMENTATION_STATUS.md)
2. **Replace the demo auth** - `lib/auth.tsx` is localStorage only
3. **Customise agent prompts** - `python/agents/prompts.py`
4. **Add a real test runner** - no `test` script exists today

## 💡 Key Features

### Document Types Recognised
- Construction Contracts
- Specification Documents
- Bills of Quantities (BOQ)
- Engineering Drawings
- Addendums/Amendments

### Analysis Provided
- Legal: LD caps, retention, termination, warranty, indemnity, arbitration
- Engineering: Scope, timeline, site conditions, drawing classification
- Accounting: Cost analysis, payment terms, qualification requirements, cash flow
- Risk: Deterministic aggregation into a score, factors, and verdict

### Output Generated
- Document classification with confidence score
- Multi-agent analysis with per-fact citations
- Deterministic pricing exposure (LD, performance security, retention lock-up)
- Bid recommendation with full audit trail

## ⚙️ Configuration

See `ENV_VAR_DOCS` in `lib/llm/config.ts` for the authoritative TypeScript list
and `python/models/factory.py` for the Python list. Minimum viable set:

```env
DATABASE_URL="postgresql://..."
OPENROUTER_API_KEY="..."
PYTHON_BACKEND_URL="http://localhost:8000"
```

Optional tracing:

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY="..."
LANGCHAIN_PROJECT=tendermind
```

## 📖 Documentation

- [README.md](./README.md) - Full project details
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - Current state, remaining work
- [AGENTS_COMPLETE_GUIDE.md](./AGENTS_COMPLETE_GUIDE.md) - Agent architecture
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [python/README.md](./python/README.md) - Python backend

## 🆘 Troubleshooting

**"Failed to reach analysis backend"**
- The Python server is not running. Start it: `uvicorn app.main:app --port 8000`
- Check `PYTHON_BACKEND_URL` matches the port you started it on

**"PDF contained no extractable text"**
- The PDF is a scanned image with no text layer. OCR it first - the extractor
  does not do OCR.

**Python backend exits immediately with `KeyError: 'DATABASE_URL'`**
- `DATABASE_URL` is required for the server to *start at all*, not just to
  persist results — `app/db.py` reads it via `os.environ[...]` during startup
  and raises a bare `KeyError` if unset. Set it before running `uvicorn`.

**"Database connection error"**
- Verify `DATABASE_URL` is set and reachable
- The Python backend also needs the `pgvector` extension enabled

**LLM provider errors on startup**
- `getLLMConfig()` throws if the selected `LLM_PROVIDER` has no API key set.
  Either set that provider's key or change `LLM_PROVIDER`.

## 📞 Need Help?

- LangGraph Docs: https://langchain-ai.github.io/langgraph/
- Next.js Docs: https://nextjs.org/docs
- OpenRouter Models: https://openrouter.ai/models
