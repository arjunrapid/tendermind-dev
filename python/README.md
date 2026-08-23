# Python analysis pipeline (LangGraph + deepagents)

A parallel rewrite of the bid-analysis pipeline (`lib/agents/*.ts`) using
LangChain "deep agents" run over LangGraph, instead of hand-rolled
`fetch`/JSON-parsing calls to a single hardcoded provider chain.

## What's here

- `models/factory.py` - **dynamic model factory**. `get_model(provider, model=None, **kwargs)`
  builds a LangChain chat model for `openai`, `google` (Gemini), `anthropic`
  (Claude), `openrouter`, or `moonshot`, reading the right API key/env-configured
  default model for whichever provider you pass in. Every agent goes through
  this instead of importing an SDK directly - switching a bid's legal agent
  from Claude to Gemini is a string change, not a code change.
- `agents/deep_agent.py` - **reusable deep-agent runner**. `run_deep_agent(system_prompt,
  user_message, tools, model, state_schema, extra_state)` builds a `deepagents`
  graph from those inputs and runs it once. Every domain agent below is just
  this function called with its own prompt/tools/model - no agent hand-rolls
  its own agent-construction code.
- `agents/prompts.py` - the legal/engineering/accounting system prompts,
  ported verbatim from the TS agents so scoring stays consistent.
- `agents/parsing.py` - shared JSON-with-regex-fallback response parsing
  (ported from each TS agent's bespoke copy of the same logic).
- `agents/tools.py` - **reusable document-extraction tool**. `extract_document_text`
  is a LangChain tool wrapping the deterministic `app/pdf_extract.py` extractor
  (`pypdf`) plus a small on-disk `DocumentStore`. Every domain agent is handed
  this tool (see `agents/nodes.py`'s `tools=DOCUMENT_TOOLS`) so extraction is
  never something the LLM does itself - it calls the tool, gets back exactly
  what `pypdf` extracted, and reasons over that. `POST /api/upload` stores the
  uploaded bytes and returns a `documentId`; passing that through to
  `/api/analyze` makes agents call the tool instead of having text pasted into
  their prompt (see `agents/prompts.py`'s `tool_user_message_for`).
- `agents/nodes.py` - `legal_agent`, `engineering_agent`, `accounting_agent`:
  each builds its model via the factory, calls `run_deep_agent`, parses the
  reply. All async.
- `agents/risk.py` - `risk_agent`: the deterministic risk-scoring/bid-decision
  aggregator, ported from `risk-agent.ts`. Not an LLM call - a pure function
  of the other three agents' outputs.
- `graph/pipeline.py` - the LangGraph `StateGraph`: `START` fans out to
  `legal`/`engineering`/`accounting` in the same superstep (real concurrent
  execution, not sequential awaits), then `risk` joins on all three before
  running.
- `agents/tracing.py` - **LangSmith tracing setup**. `configure_tracing()` (called
  once at startup) logs whether tracing is on and warns if `LANGCHAIN_TRACING_V2=true`
  is set without an API key. `agent_run_config(agent, bid_id, doc_type, ...)`
  gives every `run_deep_agent` call a consistent `run_name`/`tags`/`metadata`
  so a run in the LangSmith UI can be found by agent/bid/doc-type instead of
  scrolling an undifferentiated trace list.
- `run_analysis.py` - CLI: `python run_analysis.py doc.txt --doc-type CONTRACT --provider anthropic`.

## Tracking what agents receive (LangSmith)

Set these in `python/.env` (see `.env.example`):

```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...       # from smith.langchain.com account settings
LANGCHAIN_PROJECT=tendermind
```

That's it - no code change needed beyond what's already wired in. LangChain/
LangGraph auto-trace every run to LangSmith once those env vars are set, and
because `run_deep_agent` passes `run_name`/`tags`/`metadata` (via
`agent_run_config`), each trace in the LangSmith UI is labeled with the agent
name, bid id, doc type, and provider - filter by any of those to find one run.

Opening a trace shows, for every model call inside it (the initial call, and
any follow-up after a tool call): the exact system prompt (including whatever
memory context got injected), the exact user message, any tool calls made
(e.g. `extract_document_text` and what it returned) and their arguments, and
the raw model response - i.e. exactly what each agent received and sent, not
just its final parsed answer.

Leave `LANGCHAIN_TRACING_V2=false` (the default) to disable tracing entirely;
nothing else changes.

## FastAPI service (`app/`)

This replaces every route under `app/api/*` in the Next.js app, 1:1:

| Next.js route | FastAPI router | Endpoint |
|---|---|---|
| `app/api/upload/route.ts` | `app/routers/upload.py` | `POST /api/upload` |
| `app/api/analyze/route.ts` | `app/routers/analyze.py` | `POST /api/analyze` |
| `app/api/bids/route.ts` | `app/routers/bids.py` | `GET /api/bids` |
| `app/api/bid/[id]/route.ts` | `app/routers/bid_detail.py` | `GET`/`DELETE /api/bid/{id}` |
| `app/api/admin/boq/route.ts` | `app/routers/admin_boq.py` | `GET`/`POST /api/admin/boq` |

`/api/analyze` is the one that matters: it calls `graph.pipeline.run_pipeline(...)`
(legal/engineering/accounting run concurrently, risk joins after), then applies
the same deterministic pricing/BOQ/bid-strategy math as the TS route and
persists to the same Postgres `bids`/`boq_defaults` tables (`app/db.py`, via
`asyncpg` against `DATABASE_URL`). Supporting modules ported alongside it:

- `app/classifier.py` - keyword-based doc-type classifier (`lib/classifier.ts`)
- `app/pricing_engine.py` - deterministic LD/retention/security math (`lib/pricing-engine.ts`)
- `app/boq.py` / `app/bid_strategy.py` - BOQ cost roll-up and risk-adjusted bid pricing
- `app/pdf_extract.py` - PDF/text extraction (`pypdf`, replacing `pdf-parse`)
- `app/memory.py` - file-based agent memory (`lib/memory/manager.ts` + `injector.ts`),
  reading/writing the **same** `memory/agents/*.json` files as the TS app, and
  now wired into `agents/nodes.py` so each LLM agent injects prior learnings
  into its prompt and saves new ones after each run
- `app/db.py` - `bids`/`extracted_clauses`/`boq_defaults` tables, same schema

## Setup

```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in the API key(s)/DATABASE_URL you'll use
```

`.env` needs `DATABASE_URL` (same Postgres the Next.js app uses - copy it out
of the repo root's `.env.local`) in addition to whichever provider API key(s)
you're using.

## Run the API

```bash
uvicorn app.main:app --reload --port 8000
```

Swagger UI at `http://localhost:8000/docs`. Point the frontend's fetch calls
at this instead of the Next.js API routes (or proxy `/api/*` to it) once
you're ready to cut over; the Next.js routes under `app/api/*` haven't been
deleted so both can run side by side during migration.

## Run the pipeline standalone (no server)

```bash
python run_analysis.py ../sample-tenders/tender-caution.txt --doc-type CONTRACT --provider anthropic
```

## Picking providers per agent

`run_pipeline(..., provider=..., model=...)` currently applies one
provider/model pair to all three agents per run (simplest wiring for the
default case). To run each agent on a **different** provider, pass explicit
`provider=`/`model=` into `legal_agent(...)` / `engineering_agent(...)` /
`accounting_agent(...)` directly in `graph/pipeline.py`'s node functions - the
factory and the deep-agent runner already support it per-call; only the
pipeline's current single-provider convenience wrapper doesn't expose it yet.

## Scope / what's NOT (yet) ported

- **Citation validation** (`lib/citation-tracker.ts`) - the TS agents check
  citation coverage and log warnings on missing `[page:N]` tags. Not ported;
  the parsed assessments still carry citations inline in their text, just
  unvalidated.
- **Frontend** - `app/`, `components/` (the Next.js pages) are unchanged and
  still call the old `/api/*` routes. Point them at this service (env var
  base URL, or a reverse-proxy rule) to actually cut over.

Ask for either of the above to be wired in next.
