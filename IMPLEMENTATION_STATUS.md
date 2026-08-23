# Tendermind MVP Implementation Status

**Last Updated**: 2026-08-22
**Status**: Phases 0-4 complete. Backend mid-migration from TypeScript to Python/LangGraph.

> **Read this first:** the app currently runs on **two backends at once**. The
> Python/FastAPI service under `python/` is the live analysis pipeline; the
> TypeScript agents under `lib/agents/` are the earlier implementation, still
> present and still covered by the root `test-*.ts` scripts, but no longer on
> the request path for analysis. See [Current Architecture](#-current-architecture).

## ✅ Completed

### Phase 0: Agent Memory System (100%)
**Files Created:**
- `lib/memory/types.ts` - Memory interface definitions
- `lib/memory/manager.ts` - File-based memory persistence
- `lib/memory/injector.ts` - Memory injection into agent prompts
- `lib/memory/index.ts` - Module exports
- `MEMORY_SYSTEM_GUIDE.md` - Comprehensive usage guide

**Features Implemented:**
- ✅ File-based persistent memory (auto-saved to `memory/agents/`, gitignored)
- ✅ Automatic memory injection into agent prompts
- ✅ Memory ranking by relevance
- ✅ Memory usage tracking and statistics
- ✅ Auto-tag generation for memories
- ✅ Memory search by agent, type, tags, and content
- ✅ Singleton pattern for global access
- ✅ Full CRUD operations (Create, Read, Update, Delete)

> The Python backend **shares this same on-disk store**. `python/app/memory.py`
> is a port of `manager.ts` + `injector.ts` that reads and writes the same
> repo-root `memory/agents/*.json` files, and `agents/nodes.py` calls it on
> every agent run. Python additionally layers pgvector company-knowledge
> retrieval (`python/app/knowledge.py`) on top.

### Phase 1: LLM Provider Abstraction (100%)
**Files Created:**
- `lib/llm/types.ts` - Interface definitions for LLM providers
- `lib/llm/openrouter.ts` - OpenRouter implementation (**default provider**)
- `lib/llm/tokenrouter.ts` - TokenRouter (Qwen) implementation
- `lib/llm/anthropic.ts` - Anthropic Claude provider
- `lib/llm/factory.ts` - Provider factory with automatic fallback
- `lib/llm/config.ts` - Configuration management
- `lib/llm/index.ts` - Module exports

**Features Implemented:**
- ✅ Multi-provider abstraction layer (provider-agnostic agents)
- ✅ Three providers: OpenRouter, TokenRouter, Anthropic
- ✅ Credentials for *all* configured providers are loaded, so any provider with
      a key set is available as a fallback candidate
- ✅ Automatic failover on provider errors
- ✅ Exponential backoff retry logic
- ✅ Provider metrics tracking (calls, failures, response times)
- ✅ Environment-based provider selection
- ✅ Configuration validation
- ✅ Citation extraction from LLM responses

**Environment Variables (TypeScript side):**
```env
LLM_PROVIDER=openrouter   # default; also "tokenrouter" or "anthropic"

# OpenRouter (default provider)
OPENROUTER_API_KEY=xxx
OPENROUTER_ENDPOINT=https://openrouter.ai/api/v1
OPENROUTER_MODEL=google/gemini-2.0-flash-001
OPENROUTER_SITE_URL=xxx   # optional, sent as referer

# TokenRouter
TOKENROUTER_API_KEY=xxx
TOKENROUTER_ENDPOINT=https://api.tokenrouter.com/v1
TOKENROUTER_MODEL=qwen/qwen3.8-max-free

# Anthropic
ANTHROPIC_API_KEY=xxx

LLM_TIMEOUT_MS=30000
LLM_MAX_RETRIES=2

# Python backend (proxied routes)
PYTHON_BACKEND_URL=http://localhost:8000
```

The selected primary provider must have its key set or `getLLMConfig()` throws.
Canonical documentation for each variable lives in `ENV_VAR_DOCS` in
`lib/llm/config.ts`.

### Phase 2: Citation & Database Infrastructure (100%)
**Files Created:**
- `lib/citation-tracker.ts` - Citation tracking and validation

**Files Modified:**
- `lib/db.ts` - Enhanced schema with citations and provider tracking

**Features Implemented:**
- ✅ 100% citation validation (all facts must be cited)
- ✅ Citation extraction from LLM output
- ✅ Citation enrichment from source documents
- ✅ Citation statistics and reporting
- ✅ Enhanced Bid interface with:
  - `pricing_breakdown` - Deterministic calculations
  - `risk_factors` - Aggregated risk assessment
  - `recommendation` - Final Bid/No-Bid/Conditional
  - `llm_provider_used` - Provider provenance
  - `processing_time_ms` - Performance metrics
- ✅ Tables created by `initializeDatabase()`: `bids`, `extracted_clauses`,
      `boq_defaults`
- ✅ Database indices for query optimization

### Phase 3: LLM-Powered Agents with Memory Injection (100%)
**Files Created:**
- `lib/agents/legal-agent.ts` - LD, retention, termination, warranty, indemnity, arbitration
- `lib/agents/engineering-agent.ts` - Scope, timeline, site conditions, drawing classification
- `lib/agents/accounting-agent.ts` - Qualification assessment (Met/Not Met), payment terms
- `lib/agents/risk-agent.ts` - Aggregation and qualification-gap verdicts
- `lib/agents/mock-agents.ts` - Original stubs, retained for reference (**not imported anywhere**)

All three LLM agents follow the same pattern:

```typescript
const injector = getMemoryInjector();
const enrichedPrompt = await injector.injectMemoryContext(AGENT_PROMPT, 'legal', documentText);
const llmResponse = await callLLM({ system_prompt: enrichedPrompt, user_message: documentText });
const citationReport = validateCitations(facts);
await injector.extractAndSaveMemory('legal', llmResponse.content, bidId, docType);
```

`riskAgent()` is **deterministic** - it takes the three assessments as input and
aggregates them. It makes no LLM call.

### Phase 4: Deterministic Pricing Engine (100%)
**Files Created:**
- `lib/pricing-engine.ts` - Fixed-arithmetic calculations only (no imports, no LLM)

Contract terms are **extracted from the document** where available; the values
below are the fallback defaults, not hard-coded constants:

| Term | Default |
|---|---|
| LD cap | 10% of contract value |
| Performance security | 10% of contract value |
| Retention per invoice | 10% of invoice amount |
| Retention cap | 5% of contract value |
| Contingency | 10% |
| Target margin | 15% |

### Phase 5: Test Scenarios (100%)
**Files Created:**
- `test-reference-tender.ts` - EBTSL 7187-EBTSL-0001, expects CONDITIONAL BID
- `test-tender-strong-bid.ts` - expects LOW risk, PROCEED
- `test-tender-moderate-risk.ts` - expects MEDIUM risk, PROCEED_WITH_CAUTION
- `test-tender-high-risk.ts` - expects HIGH risk, DO_NOT_PROCEED
- `test-pricing-engine.ts` - deterministic math assertions
- `test-legal-agent.ts` - single-agent smoke test
- `lib/test-utils/run-tender-scenario.ts` - shared scenario harness

⚠️ There is no `test` script in `package.json`, and neither `ts-node` nor `tsx`
is a declared dependency. These are run ad hoc, e.g. `npx tsx test-pricing-engine.ts`.

### Phase 6: Python/FastAPI Backend + LangGraph (100%)
**Files Created:** see `python/` and `python/README.md`.

- ✅ FastAPI service (`python/app/main.py`), run with `uvicorn app.main:app --reload --port 8000`
- ✅ LangGraph pipeline (`python/graph/pipeline.py`) with orchestrator, legal,
      engineering, accounting, and risk nodes
- ✅ LangSmith tracing (`python/agents/tracing.py`)
- ✅ pgvector-backed company knowledge retrieval (`python/app/knowledge.py`)
- ✅ Per-agent model selection via `/api/admin/models`
- ✅ Company context store via `/api/company-context`
- ✅ Multi-provider model factory (`python/models/factory.py`): openai, google,
      anthropic, openrouter, moonshot

**Environment Variables (Python side):**
```env
DATABASE_URL=postgresql://...      # required
DEFAULT_LLM_PROVIDER=anthropic     # default when an agent has no explicit provider

OPENAI_API_KEY / OPENAI_DEFAULT_MODEL
GOOGLE_API_KEY / GOOGLE_DEFAULT_MODEL
ANTHROPIC_API_KEY / ANTHROPIC_DEFAULT_MODEL
OPENROUTER_API_KEY / OPENROUTER_DEFAULT_MODEL
MOONSHOT_API_KEY / MOONSHOT_DEFAULT_MODEL

OPENAI_EMBEDDING_MODEL
OPENROUTER_EMBEDDING_MODEL

LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=xxx
LANGCHAIN_PROJECT=tendermind
```

## 🔧 Current Architecture

The Next.js API routes are **partially migrated**. Three routes proxy to Python;
the rest still run natively in TypeScript against Vercel Postgres.

| Next.js route | Behaviour |
|---|---|
| `POST /api/analyze` | **Proxies** to Python `POST /api/analyze` |
| `GET/POST /api/admin/models` | **Proxies** to Python |
| `/api/company-context` | **Proxies** to Python |
| `POST /api/upload` | Native TypeScript |
| `GET /api/bids` | Native TypeScript |
| `GET/DELETE /api/bid/[id]` | Native TypeScript |
| `GET/POST /api/admin/boq` | Native TypeScript |

Analysis request path:

```
User Upload → POST /api/upload (Next.js, Vercel Blob + Postgres)
  ↓
POST /api/analyze (Next.js) → thin proxy, no shape translation
  ↓
Python FastAPI POST /api/analyze
  ↓
LangGraph pipeline (python/graph/pipeline.py)
  orchestrator → legal ┐
                 eng   ├→ risk (deterministic aggregation)
                 acct  ┘
  ├→ per-agent model resolved via /api/admin/models, else DEFAULT_LLM_PROVIDER
  ├→ pgvector company-knowledge retrieval (app/knowledge.py)
  └→ LangSmith tracing (agents/tracing.py)
  ↓
Store in Postgres (DATABASE_URL) → response
```

Both backends deliberately share the same response shape (`fileName`,
`classification`, `legalAssessment`, `engineeringAssessment`,
`accountingAssessment`, `riskAssessment`, `pricingBreakdown`,
`bidRecommendation`, `id`) so the proxy needs no translation layer.

**The TypeScript agent pipeline (`lib/agents/*.ts`) is not on this path.** It is
retained and exercised only by the root `test-*.ts` scripts. Routing analysis
through it would skip LangGraph tracing and pgvector retrieval.

## 🚀 How to Use (TypeScript agents)

These APIs are still valid for the `lib/` code and the test scripts.

**Basic LLM Call:**
```typescript
import { callLLM } from '@/lib/llm';

const response = await callLLM({
  system_prompt: "You are a legal expert...",
  user_message: "Extract LD caps from this contract...",
  max_tokens: 1024,
});

console.log(`Used provider: ${response.provider_used}`);
console.log(`Citations found: ${response.citations.length}`);
```

**Citation validation:**
```typescript
import { validateCitations } from '@/lib/citation-tracker';

const validation = validateCitations(facts);
if (!validation.is_compliant) {
  console.warn('Citation coverage:', validation.citation_coverage_percent, '%');
  console.warn('Uncited facts:', validation.uncited_facts);
}
```

**Configuration:**
```typescript
import { getLLMConfig, getLLMFactory, getLLMMetrics } from '@/lib/llm';

const config = getLLMConfig();
console.log('Primary provider:', config.provider);

const metrics = getLLMMetrics();
console.log('Fallback activations:', metrics.fallback.calls);
```

## ✅ Verified locally (2026-08-23)

Confirmed by actually installing and running, not by inspection.

**Frontend / build:**
- `npm install` — clean, 100 packages, 0 vulnerabilities
- `npm run build` — **succeeds, zero TypeScript errors**, 16 routes generated
  (Next.js 16.3.2, Turbopack)
- `npx tsx test-pricing-engine.ts` — **all 22 assertions pass**
- `npm run dev` — serves on :3000; login and role-gated admin nav work

**Real local Postgres, no Docker/Homebrew:** `scripts/local-postgres.sh` (added
this session) gets a real Postgres 16 + pgvector 0.6.2 running locally with no
sudo, via the `pgserver` PyPI package in a dedicated `uv`-managed Python 3.12
venv (pgserver has no wheels past 3.12; the app's own Python side stays on
whatever version you run it with — verified against 3.14). Cold start
(fetch CPython 3.12 + pgserver + initdb) takes under a minute; subsequent
starts under 2 seconds.

**Python backend, against that real database:**
- `pip install -r requirements.txt` — clean on Python 3.14
- `uvicorn app.main:app` boots clean with `DATABASE_URL` set — all 6 tables
  auto-created: `bids`, `extracted_clauses`, `boq_defaults`,
  `agent_model_overrides`, `company_context`, and `knowledge_chunks`
  (`embedding vector(1536)`, `ivfflat (embedding vector_cosine_ops)` index —
  the pgvector-backed company-knowledge table, previously undocumented by name)
- `GET /api/health` → `{"status":"ok","tracing_enabled":false}`
- `GET /api/bids` → `{"bids":[],"count":0,"hasMore":false}` (was HTTP 500
  without a database)
- **Full pipeline ran end-to-end** with no LLM key configured: `POST
  /api/analyze` returned HTTP 200, not an error. The orchestrator → three
  domain agents → risk agent path executed for real; each domain agent failed
  gracefully (`provider_used: "error"`) exactly as designed, and risk
  aggregation correctly detected the failures and returned
  `bid_decision: "MANUAL_REVIEW"`, `recommendation: "MANUAL_REVIEW_REQUIRED"`,
  `risk_score: null`, `risk_level: "UNKNOWN"` — matching what
  [AGENTS_COMPLETE_GUIDE.md](./AGENTS_COMPLETE_GUIDE.md) documents. The result
  persisted with a real UUID and reappeared on a subsequent `GET /api/bids`.
- This run also surfaced response fields not previously documented anywhere:
  `bidRecommendation` carries `profit_amount`, `pricing_strategy_rationale`,
  `ld_cap_amount`, `performance_security_amount`, `total_lockup`,
  `bid_decision`, `confidence_score`, and `agent_timings_ms{}`; when the
  accounting agent doesn't produce its own `total_estimated_cost`,
  `accountingAssessment` gets filled in from the admin BOQ defaults with
  `material_costs`, `labor_costs`, `contingency_percentage`,
  `total_estimated_cost`, and `boq_breakdown[]`. See the corrected example in
  [AGENTS_COMPLETE_GUIDE.md](./AGENTS_COMPLETE_GUIDE.md).

**A genuinely important finding — `@vercel/postgres` cannot use this database:**
`lib/db.ts`'s `sql` tagged-template (from `@vercel/postgres`, which re-exports
`@neondatabase/serverless`) is **hardcoded to Neon's HTTP proxy protocol**, not
the Postgres wire protocol. Pointed at the local Postgres above over plain TCP,
it fails outright: `"Error connecting to database: fetch failed"` — even with
a well-formed `postgresql://` connection string. This means:
- The Python backend can use any real Postgres, local or hosted.
- The TypeScript routes (`upload`, `bids`, `bid/[id]`, `admin/boq`) **cannot**
  run against a local Postgres at all — they need an actual Neon or Vercel
  Postgres instance, or Neon's local HTTP proxy (itself Docker-only, so
  unavailable in this environment). This was not documented anywhere before
  this session and materially affects local development of the TS routes.

Not verified (needs credentials): any actual LLM provider call — every agent
in the run above failed at the provider-call step since no API key was set,
which is precisely why the graceful-degradation path could be exercised
instead. Also unverified: pgvector retrieval actually returning relevant
results (the table and index exist and accept writes; a real embedding call
needs a provider key), and the full reference tender scenario.

⚠️ Note: `npx tsc --noEmit` on its own reports a false error
(`Cannot find name 'LayoutProps'` in `app/layout.tsx`). That type is generated
into `.next/types` by the build, so typecheck via `npm run build`, not bare `tsc`.

## 📋 Remaining Work

- [ ] Finish migrating `upload`, `bids`, `bid/[id]`, and `admin/boq` to the
      Python backend, or decide they stay in TypeScript
- [ ] Decide the fate of `lib/agents/*.ts` - keep as reference, or delete once
      the Python pipeline is authoritative
- [ ] Delete `lib/agents/mock-agents.ts` (unreferenced)
- [ ] Add a `test` script to `package.json` and declare a TS runner
- [ ] Update the Anthropic TS provider default model - `lib/llm/anthropic.ts`
      still pins `claude-3-5-sonnet-20241022`, while the Python factory uses
      `claude-sonnet-4-5-20250929`
- [ ] Commit a `.env.local.example` (currently no env template is in the repo)
- [ ] Replace the scaffold metadata in `app/layout.tsx` — the browser tab still
      reads "Create Next App" / "Generated by create next app"
- [ ] Give `app/db.py` a clear error when `DATABASE_URL` is unset instead of a
      bare `KeyError` that kills startup
- [ ] Migrate off `@vercel/postgres` — npm reports it as **deprecated**, with
      Vercel Postgres databases moved to Neon
- [ ] End-to-end run of the reference tender (EBTSL 7187) through the Python path

**Expected Output for EBTSL 7187-EBTSL-0001:**
```
CONDITIONAL BID

Financial Criteria: MET (turnover ≥ INR 150Cr, solvency ≥ INR 100Cr)

Technical/Experience Criterion: NOT MET (bidder has only 30% of required experience)
  → Remedial: JV/consortium allowed per Annexure A
  → Status: Closeable

LD Exposure: INR [10% of contract value]
Security + Retention Lock-up: 15% of contract value

Recommendation: Pursue bid contingent on securing qualifying JV partner
```

## ⚠️ Known Limitations

1. **Two backends running in parallel.** Analysis behaviour depends on which
   path a route takes. `/api/analyze` requires the Python server to be running
   or it returns a connection error.
2. **Citation Extraction:** Regex patterns handle standard formats
   `[page:5, section:Art. 6.2]`. Custom patterns needed for non-standard formatting.
3. **Provider Timeouts:** TS providers time out after 30s by default
   (`LLM_TIMEOUT_MS`). Long documents (500+ pages) may need adjustment.
4. **Database:** Requires a Postgres connection. The TS side uses
   `@vercel/postgres`; the Python side reads `DATABASE_URL` directly and needs
   the `pgvector` extension.
5. **No env template in the repo.** `.env*` is gitignored and no example file
   is committed, so new developers have to derive the variable list from
   `lib/llm/config.ts` and `python/models/factory.py`.

## 📝 Environment Setup for Next Developer

```bash
# 1. Create your env file (no template is committed - see the env blocks above)
touch .env.local

# 2. Set at minimum an LLM key for the default provider
OPENROUTER_API_KEY=your_key_here

# 3. Postgres connection (pgvector extension required for the Python backend)
DATABASE_URL=postgresql://user:pass@localhost:5432/bid_analyzer

# 4. Frontend
npm install
npm run dev

# 5. Python backend (required for /api/analyze)
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/api/health` returns status and whether
tracing is enabled.

## 🔗 References

- OpenRouter models: https://openrouter.ai/models
- TokenRouter API: https://tokenrouter.com
- Tendermind PRD: See Tendermind_Bid_NoBid_Advisor_Consolidated.docx
- Reference Tender: EBTSL 7187-EBTSL-0001
