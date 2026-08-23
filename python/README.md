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
  (`pypdf`) plus a small on-disk `DocumentStore`, so extraction is never
  something the LLM does itself - it calls the tool, gets back exactly what
  `pypdf` extracted, and reasons over that. `POST /api/upload` stores the
  uploaded bytes and returns a `documentId`; passing that through to
  `/api/analyze` makes agents call the tool instead of having text pasted into
  their prompt (see `agents/prompts.py`'s `tool_user_message_for`).

  Tool wiring is decided per agent by `agents/nodes.py`'s `_tools_for(agent,
  routed_text)`, not a fixed list: `extract_document_text` is offered **only**
  when the agent has no routed text already in its prompt (offering it anyway
  led models to call it with hallucinated document ids and fail the run), while
  `get_company_context` is always offered. Both are domain-scoped, so an agent
  only ever sees its own slice.

- `agents/orchestrator.py` - **document-routing orchestrator**. Runs once per
  bid, before the three domain agents. An LLM reads the whole document and
  splits it into three verbatim per-domain excerpts, so each downstream agent
  receives only content relevant to its specialty. Routing is judgment-based
  rather than keyword-based, so a clause like "the contractor shall bear all
  costs arising from delay" lands in legal even though no keyword list would
  predict it. Falls back to `app/document_sections.py`'s keyword filter if the
  call or JSON parse fails.
- `agents/nodes.py` - `legal_agent`, `engineering_agent`, `accounting_agent`:
  each builds its model via the factory, calls `run_deep_agent`, parses the
  reply. All async.
- `agents/risk.py` - `risk_agent`: the deterministic risk-scoring/bid-decision
  aggregator, ported from `risk-agent.ts`. Not an LLM call - a pure function
  of the other three agents' outputs.
- `graph/pipeline.py` - the LangGraph `StateGraph`: `START` → `orchestrator`
  (runs first and alone), which then fans out to `legal`/`engineering`/
  `accounting` in the same superstep (real concurrent execution, not sequential
  awaits), then `risk` joins on all three before running. `_resolve_model`
  picks each node's provider/model - per-agent override first, then the
  request-level provider/model, then `DEFAULT_LLM_PROVIDER`.
- `agents/tracing.py` - **LangSmith tracing setup**. `configure_tracing()` (called
  once at startup) logs whether tracing is on and warns if `LANGCHAIN_TRACING_V2=true`
  is set without an API key. `agent_run_config(agent, bid_id, doc_type, ...)`
  gives every `run_deep_agent` call a consistent `run_name`/`tags`/`metadata`
  so a run in the LangSmith UI can be found by agent/bid/doc-type instead of
  scrolling an undifferentiated trace list.
- `run_analysis.py` - CLI: `python run_analysis.py doc.txt --doc-type CONTRACT --provider anthropic`.

## Tracking what agents receive (LangSmith)

Set these in `python/.env` (create it by hand - no `.env.example` is committed):

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

This covers every route under `app/api/*` in the Next.js app, plus three that
have no TypeScript equivalent:

| Next.js route | FastAPI router | Endpoint |
|---|---|---|
| `app/api/upload/route.ts` | `app/routers/upload.py` | `POST /api/upload` |
| `app/api/analyze/route.ts` | `app/routers/analyze.py` | `POST /api/analyze` |
| `app/api/bids/route.ts` | `app/routers/bids.py` | `GET /api/bids` |
| `app/api/bid/[id]/route.ts` | `app/routers/bid_detail.py` | `GET`/`DELETE /api/bid/{id}` |
| `app/api/admin/boq/route.ts` | `app/routers/admin_boq.py` | `GET`/`POST /api/admin/boq` |
| _(new, no TS equivalent)_ | `app/routers/admin_models.py` | `GET`/`POST /api/admin/models` |
| _(new, no TS equivalent)_ | `app/routers/company_context.py` | `GET`/`POST /api/company-context`, `DELETE /api/company-context/{id}` |
| _(new, no TS equivalent)_ | `app/main.py` | `GET /api/health` |

`/api/analyze` is the one that matters: it calls `graph.pipeline.run_pipeline(...)`
(orchestrator first, then legal/engineering/accounting concurrently, risk joins
after), then applies
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
  into its prompt and saves new ones after each run. Note each agent applies
  **two** context layers in order: `inject_memory_context()` first, then
  `_inject_knowledge()` for pgvector retrieval.
- `app/db.py` - `bids`/`extracted_clauses`/`boq_defaults` tables, same schema
- `app/knowledge.py` - **pgvector company knowledge**. Embeds each completed
  assessment and indexes it; `retrieve_domain_context()` pulls the most similar
  chunks from *other* bids into an agent's system prompt, filtered by domain at
  the query level so no other agent's domain can leak in. No TS equivalent.
- `app/embeddings.py` - embedding calls behind `knowledge.py`
  (`OPENAI_EMBEDDING_MODEL` / `OPENROUTER_EMBEDDING_MODEL`)
- `app/company_context.py` - curated policies/standards an admin uploads via the
  Company Context page, surfaced to agents through the `get_company_context` tool
- `app/document_sections.py` - keyword-based per-domain filter; the
  orchestrator's fallback path

## Setup

```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Then create `python/.env` by hand - **no `.env.example` is committed** (`.env*`
is gitignored repo-wide). It needs `DATABASE_URL` (same Postgres the Next.js app
uses - copy it out of the repo root's `.env.local`; the `pgvector` extension must
be enabled) plus whichever provider API key(s) you're using, and optionally
`DEFAULT_LLM_PROVIDER` (defaults to `anthropic`).

## Run the API

```bash
uvicorn app.main:app --reload --port 8000
```

Swagger UI at `http://localhost:8000/docs`; liveness and tracing status at
`http://localhost:8000/api/health`.

**Cutover is partially done.** Three Next.js routes now proxy here rather than
running their own logic - `/api/analyze`, `/api/admin/models`, and
`/api/company-context` (via `PYTHON_BACKEND_URL`, default
`http://localhost:8000`). The rest - `upload`, `bids`, `bid/[id]`, `admin/boq` -
still run natively in TypeScript. Request/response shapes are identical on both
sides, so the proxies need no translation layer.

## Run the pipeline standalone (no server)

```bash
python run_analysis.py ../sample-tenders/tender-caution.txt --doc-type CONTRACT --provider anthropic
```

## Picking providers per agent

Per-agent provider selection is wired up. `run_pipeline(..., provider=...,
model=..., agent_overrides={...})` resolves each node's model through
`_resolve_model` in this order:

1. an explicit per-agent override (`agent_overrides`, persisted and edited via
   `GET`/`POST /api/admin/models` and the `/admin/models` page)
2. the request-level `provider=`/`model=` pair
3. `DEFAULT_LLM_PROVIDER` (defaults to `anthropic`)

So running the legal agent on Claude and the engineering agent on Gemini in the
same analysis is a settings change, not a code change.

## Scope / what's NOT (yet) ported

- **Citation validation** (`lib/citation-tracker.ts`) - the TS agents check
  citation coverage and log warnings on missing `[page:N]` tags. Still not
  ported; the parsed assessments carry citations inline in their text, but
  nothing verifies coverage. Python has only `strip_citation()` /
  `_strip_citations()` display helpers. This is the largest remaining behaviour
  gap between the two pipelines.
- **Remaining routes** - `upload`, `bids`, `bid/[id]`, and `admin/boq` still run
  natively in TypeScript. Either finish porting them or decide they stay.
