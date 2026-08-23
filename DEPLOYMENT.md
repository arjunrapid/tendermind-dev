# Tendermind - Deployment Guide

> ⚠️ **Deployment is not a solved problem for this project yet.** The app is
> split across two runtimes: a Next.js frontend and a Python/FastAPI analysis
> backend. Vercel hosts the Next.js half; the Python half needs a separate host.
> There is no deployment configuration committed for the Python service.

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- Postgres with the `pgvector` extension for the **Python** backend — a real
  local Postgres works fine here (see `scripts/local-postgres.sh` below)
- **A real Neon or Vercel Postgres instance** for the **TypeScript** routes
  (`upload`, `bids`, `bid/[id]`, `admin/boq`) — `lib/db.ts`'s `@vercel/postgres`
  `sql` tag is hardcoded to Neon's HTTP proxy protocol and will not connect to
  a self-hosted Postgres over plain TCP at all (verified: `"Error connecting
  to database: fetch failed"`). No local-only substitute exists for this half.

### Setup

1. **Install frontend dependencies**
```bash
npm install
```

2. **Set up environment variables**

No template is committed (`.env*` is gitignored). Create `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bid_analyzer"
OPENROUTER_API_KEY="..."
PYTHON_BACKEND_URL="http://localhost:8000"
```

Authoritative variable lists: `ENV_VAR_DOCS` in `lib/llm/config.ts` and
`python/models/factory.py`.

**No Postgres available, and no Docker/Homebrew to get one?** — for the
**Python** backend only (see the prerequisites note above):

```bash
scripts/local-postgres.sh start
export DATABASE_URL=$(scripts/local-postgres.sh uri)
```

Runs a real Postgres 16 + pgvector via the `pgserver` PyPI package in a
dedicated `uv`-managed venv — no sudo, no system packages. `scripts/status`,
`stop`, and `psql` subcommands are also available; see the script's header
comment for how it works. Verified working this session end-to-end: the
Python backend boots against it, auto-creates all six tables, and a full
`/api/analyze` run persists and reads back correctly.

3. **Run the frontend**
```bash
npm run dev
```
→ `http://localhost:3000`

4. **Run the Python backend** (required for `/api/analyze`)
```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
→ Swagger UI at `http://localhost:8000/docs`, health at `/api/health`

## Deploying

### The two-runtime problem

| Route | Runtime | Deploys to |
|---|---|---|
| `POST /api/upload` | Next.js | Vercel |
| `GET /api/bids` | Next.js | Vercel |
| `GET/DELETE /api/bid/[id]` | Next.js | Vercel |
| `GET/POST /api/admin/boq` | Next.js | Vercel |
| `POST /api/analyze` | **proxy → Python** | needs a Python host |
| `GET/POST /api/admin/models` | **proxy → Python** | needs a Python host |
| `/api/company-context` | **proxy → Python** | needs a Python host |

Deploying only the Next.js app produces a site where upload and history work but
analysis fails. `PYTHON_BACKEND_URL` must point at a reachable FastAPI instance.

### 1. Next.js frontend (Vercel)

1. Push to GitHub.
2. vercel.com → New Project → import the repository.
3. Project Settings → Environment Variables:
   - `DATABASE_URL` — your Postgres connection string
   - `PYTHON_BACKEND_URL` — public URL of the deployed FastAPI service
   - `OPENROUTER_API_KEY` (or whichever provider `LLM_PROVIDER` names)
   - `BLOB_READ_WRITE_TOKEN` — if using Vercel Blob for uploads
4. Deploy.

⚠️ **Function timeout.** Vercel's free tier caps serverless functions at 10s.
A full tender analysis takes considerably longer, and `/api/analyze` holds the
request open while the Python pipeline runs — it does not return a job id. Expect
timeouts on the free tier. Options: a paid Vercel plan with a longer limit, or
rework `/api/analyze` to be asynchronous (see the queue discussion in
[TENDER_ASSISTANT.md](./TENDER_ASSISTANT.md) §4.2).

### 2. Python backend (host TBD)

Nothing is committed for this — no Dockerfile, no `Procfile`, no platform config.
Any host that runs `uvicorn` works (Fly.io, Railway, Render, Cloud Run, a VM).
The service needs:

- `DATABASE_URL` reachable from the host, with `pgvector` enabled
- `DEFAULT_LLM_PROVIDER` plus that provider's API key
- Optionally `LANGCHAIN_TRACING_V2` / `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

CORS is currently `allow_origins=["*"]` (`python/app/main.py`). **Restrict this
before exposing the service publicly.**

### 3. Database

In production both runtimes talk to the same Postgres. **Locally they can't** —
see the prerequisites note above; only the Python side can use a self-hosted
instance.

- Tables are created automatically on first use (`lib/db.ts` `initializeDatabase()`,
  `python/app/db.py` on startup)
- Tables (verified by actually running the Python backend against a fresh
  database): `bids`, `extracted_clauses`, `boq_defaults`, `company_context`,
  `agent_model_overrides`, and `knowledge_chunks` (the pgvector-backed one —
  `embedding vector(1536)` with an `ivfflat` cosine-similarity index)
- The `pgvector` extension must be enabled or the Python backend's knowledge
  retrieval fails

## Pre-deployment checklist

- [ ] Replace the demo auth. `lib/auth.tsx` stores credentials and session in
      client-side `localStorage` — it is not authentication and anyone can bypass
      it. **This is a blocker for any real deployment.**
- [ ] Restrict CORS on the FastAPI service
- [ ] Decide the `/api/analyze` timeout story (async job, or a plan with a
      longer function limit)
- [ ] Confirm your LLM provider's data-retention terms — tender documents are
      commercially sensitive (see [TENDER_ASSISTANT.md](./TENDER_ASSISTANT.md) §9)
- [ ] Note that agent memory writes to `memory/agents/*.json` on local disk,
      which does not persist on serverless or ephemeral-filesystem hosts

## Architecture

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS 4
- **State**: React Hooks

### Backends
- **Analysis**: Python + FastAPI + LangGraph + LangSmith
- **Everything else**: Next.js route handlers on Vercel Functions

### Database
- **Type**: Postgres + pgvector (Neon / Vercel Postgres)
- **Access**: raw SQL via `@vercel/postgres` (TS) and `asyncpg` (Python)

### Storage
- Vercel Blob for uploaded PDFs

## Free Tier Limits

### Vercel
- **Bandwidth**: 100GB/month
- **Execution time**: 10 seconds per function — see the timeout warning above

### Postgres (free tiers)
- Storage and transaction caps vary by provider; check current Neon/Vercel terms

## Cost

- **Vercel hosting**: free tier possible for the frontend
- **Python host**: varies; a small always-on instance is the usual floor
- **LLM calls**: the real variable cost. Depends on `DEFAULT_LLM_PROVIDER`, the
  model chosen per agent at `/admin/models`, and document size. Four LLM calls
  per analysis (orchestrator + three domain agents).

## Troubleshooting

**"Failed to reach analysis backend"**
- The Python service is down or `PYTHON_BACKEND_URL` is wrong

**Python service exits on boot with `KeyError: 'DATABASE_URL'`**
- The variable is a hard startup requirement (`python/app/db.py`), not just a
  runtime one. The service will not accept connections without it.

**Database connection issues**
- Verify `DATABASE_URL` in both environments
- Confirm `pgvector` is enabled
- Check the host's IP allowlist

**Analysis times out**
- Vercel function limit; see the timeout warning above

**"PDF contained no extractable text"**
- Scanned PDF with no text layer. There is no OCR fallback.

**Agent memory disappears between requests**
- Expected on ephemeral filesystems — `memory/agents/` is local disk

## Monitoring

1. Vercel Dashboard → Analytics and function logs
2. LangSmith traces for agent runs (`LANGCHAIN_TRACING_V2=true`)
3. `GET /api/health` on the Python service for liveness and tracing status
4. Database usage in your Postgres provider's dashboard

## License

MIT License
