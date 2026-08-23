# Tendermind - Complete Agent Implementation Guide

**Last Updated**: 2026-08-22

## 📊 Status Overview

There are **two agent implementations** in this repository:

| | Python (`python/`) | TypeScript (`lib/agents/`) |
|---|---|---|
| Status | **Live** - serves `/api/analyze` | Legacy - test scripts only |
| Framework | LangGraph + `deepagents` | Direct `callLLM()` calls |
| Orchestration | Orchestrator node + parallel fan-out | Sequential calls in test harness |
| Context | File-based memory **+** pgvector knowledge + company context tool | File-based agent memory |
| Tracing | LangSmith | Console logging |

The two share the same **risk scoring algorithm**, the same **assessment
shapes**, and the same **response contract**, so this guide describes them
together and flags differences where they exist.

| Agent | LLM? | Python | TypeScript |
|-------|------|--------|------------|
| Orchestrator | Yes | `agents/orchestrator.py` | — (no equivalent) |
| Legal | Yes | `agents/nodes.py::legal_agent` | `lib/agents/legal-agent.ts` |
| Engineering | Yes | `agents/nodes.py::engineering_agent` | `lib/agents/engineering-agent.ts` |
| Accounting | Yes | `agents/nodes.py::accounting_agent` | `lib/agents/accounting-agent.ts` |
| Risk | **No** - deterministic | `agents/risk.py::risk_agent` | `lib/agents/risk-agent.ts` |
| Pricing | **No** - deterministic | `app/pricing_engine.py` | `lib/pricing-engine.ts` |

---

## 🏗️ Architecture Overview

### Live pipeline (Python / LangGraph)

Defined in `python/graph/pipeline.py`:

```
                    START
                      ↓
              ┌───────────────┐
              │  Orchestrator │  Reads the whole document once and splits it
              │     (LLM)     │  into three verbatim per-domain excerpts.
              └───────────────┘  Falls back to keyword filtering
                      ↓          (app/document_sections.py) on failure.
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓        ← fan-out: all three run in
  ┌──────────┐  ┌──────────┐  ┌──────────┐     parallel, each seeing only
  │  Legal   │  │Engineering│ │Accounting│     its own excerpt
  │  (LLM)   │  │  (LLM)   │  │  (LLM)   │
  └──────────┘  └──────────┘  └──────────┘
        └─────────────┼─────────────┘
                      ↓        ← join: risk waits for all three
              ┌───────────────┐
              │  Risk Agent   │  Deterministic aggregation. No LLM.
              │(deterministic)│
              └───────────────┘
                      ↓
                     END
```

**Why the orchestrator exists**: without it, all three domain agents received
the entire document. The orchestrator routes judgment-based rather than by
keyword, so a clause like "the contractor shall bear all costs arising from
delay" is correctly routed to legal even though no keyword list would predict it.

### Legacy pipeline (TypeScript)

No orchestrator. Each agent receives the full document text, injects file-based
memory context, calls `callLLM()`, validates citations, and saves learnings. The
risk agent then aggregates. This path is exercised only by the root `test-*.ts`
scripts.

---

## 🎯 What Each Agent Does

### Orchestrator (Python only)

**Input**: full document text
**Output**: `{ legal_content, engineering_content, accounting_content }`

Reproduces relevant source text **verbatim** (no summarising or paraphrasing),
preserving any existing `[page:N, section:X]` citations. Content relevant to
more than one domain may appear in more than one excerpt. Falls back to
`app/document_sections.py` keyword filtering if the LLM call or JSON parse fails.

---

### Legal Agent

**Input**: contract/legal content
**Output**: `LegalAssessment`

```typescript
{
  compliance_issues: string[];    // Non-compliance findings
  contract_terms: string[];       // Critical terms extracted
  risks: string[];                // Legal risks identified
  overall_assessment: string;     // Leads with GREEN / YELLOW / RED
  citations_valid?: boolean;
  provider_used?: string;
}
```

**Focus areas**: regulatory compliance, contractual terms (payment, liability,
termination), legal obligations (indemnification, warranty), dispute resolution,
liquidated damages, insurance/bonding.

**System prompt**: expert construction contract lawyer, EPC focus
(`python/agents/prompts.py::LEGAL_AGENT_SYSTEM_PROMPT`).

⚠️ `overall_assessment` must **lead** with the rating word — the risk agent
reads the rating from the front of the string (`hasRatingWord` / `_leading_rating`)
rather than substring-matching, to avoid false positives from words like "RED"
inside "REDUCED".

---

### Engineering Agent

**Input**: technical scope/specification content
**Output**: `EngineeringAssessment`

```typescript
{
  scope_analysis: string[];
  structural_concerns: string[];
  timeline_estimate: string;
  feasibility: string;            // Leads with HIGH / MEDIUM / LOW
  site_requirements?: string[];
  citations_valid?: boolean;
  provider_used?: string;
}
```

**Focus areas**: scope clarity, technical feasibility, schedule realism, site and
logistics requirements, structural and design concerns.

---

### Accounting Agent

**Input**: cost/payment/financial-qualification content
**Output**: `AccountingAssessment`

```typescript
{
  cost_analysis: string[];
  payment_terms: string[];
  qualification_requirements: string[];
  cash_flow_analysis: string;
  total_estimated_cost?: number;
  citations_valid?: boolean;
  provider_used?: string;
}
```

**Focus areas**: cost estimation, payment terms and cash-flow timing, financial
qualification requirements, retention and performance security, contingency.

Note: unlike legal and engineering, the accounting assessment carries **no
explicit rating field**, which affects how it is scored (see below).

---

### Risk Agent (deterministic)

**Input**: the three assessments above
**Output**: `RiskAssessment`

```typescript
{
  risk_score: number | null;   // 0.0-1.0; null when bid_decision is MANUAL_REVIEW
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  risk_factors: string[];
  mitigation_strategies: string[];
  recommendation: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'DO_NOT_PROCEED'
                | 'MANUAL_REVIEW_REQUIRED';
  recommendation_rationale: string;
  aggregated_findings: string;
  contract_summary: string;
  bid_decision: 'YES' | 'NO' | 'MANUAL_REVIEW';
}
```

**Makes no LLM call.** It purely aggregates.

If any upstream agent failed, the risk agent returns the manual-review result:
`recommendation: 'MANUAL_REVIEW_REQUIRED'`, `bid_decision: 'MANUAL_REVIEW'`,
`risk_score: null`, `risk_level: 'UNKNOWN'` — it does not score a partial run.

`bid_decision` is forced to `NO` whenever `recommendation` is `DO_NOT_PROCEED`,
so the two can never contradict each other.

---

## 📊 Risk Scoring Algorithm

Identical in `lib/agents/risk-agent.ts` and `python/agents/risk.py`.

### Severity ratings drive the score, counts only modify it

Each agent's own qualitative rating carries **65%** of its component; the number
of items it listed carries **35%**. Counting alone was found to cluster nearly
every document around 0.55-0.70 regardless of content, because agents list terms
(indemnity cap, warranty, LDs, retention) whether or not those terms are
unfavourable.

```
ratingToScore(legal.overall_assessment):       RED → 0.9,  GREEN → 0.15,  else 0.5
feasibilityToScore(engineering.feasibility):   LOW → 0.9,  HIGH  → 0.15,  else 0.5

countFactor(n, cap) = min(n / cap, 1.0)

legal_component       = ratingToScore(...)      * 0.65 + countFactor(legal_risks, 12) * 0.35
engineering_component = feasibilityToScore(...) * 0.65 + countFactor(eng_risks, 10)   * 0.35
accounting_component  = countFactor(acct_risks, 10)        // count-based: no rating field

risk_score = legal_component       * 0.40
           + engineering_component * 0.35
           + accounting_component  * 0.25
```

Note the two different weight layers: **0.65/0.35** is rating-vs-count *within*
legal and engineering; **0.40/0.35/0.25** is the weighting *across* the three
domains.

### Risk level

```
score <  0.33  → LOW
score <  0.67  → MEDIUM
score >= 0.67  → HIGH
```

### Recommendation logic

Evaluated in this order — the first match wins:

```
legal risk count      > 8   → DO_NOT_PROCEED
engineering risk count > 7  → DO_NOT_PROCEED
risk_level == HIGH          → DO_NOT_PROCEED
risk_level == MEDIUM        → PROCEED_WITH_CAUTION
otherwise                   → PROCEED
```

A MEDIUM risk level always yields `PROCEED_WITH_CAUTION`; there is no
issue-count escalation from MEDIUM to `DO_NOT_PROCEED`.

---

## 💵 Pricing Engine (`lib/pricing-engine.ts`, `python/app/pricing_engine.py`)

Purely deterministic math — **no LLM calls**, per the PRD's "no LLM for math"
decision. Two entry points on the TypeScript side:

- `calculatePricing(inputs)` — pass explicit numbers, get a full `PricingBreakdown`.
- `calculatePricingFromDocument(documentText)` — regex-extracts contract value,
  LD rate/cap, performance security %, and retention % from the source document,
  falling back to `DEFAULT_PRICING_PARAMETERS` for anything not stated. Every
  fallback is recorded in `assumptions_used` for auditability.

**Calculations**:
```
material_cost + labor_cost → base_cost
contingency_amount         = base_cost * contingency_%
total_estimated_cost       = base_cost + contingency_amount
recommended_bid_price      = total_estimated_cost * (1 + target_margin_%)

ld_exposure_per_week       = contract_value * ld_rate_per_week_%
ld_cap_amount              = contract_value * ld_cap_%
weeks_to_reach_cap         = ceil(ld_cap_amount / ld_exposure_per_week)

performance_security_amount = contract_value * performance_security_%
retention_per_invoice       = (contract_value / invoices_count) * retention_rate_%
total_retention_held        = min(retention_per_invoice * invoices_count,
                                  contract_value * retention_cap_%)

total_lockup = performance_security_amount + total_retention_held
```

**Defaults** (`DEFAULT_PRICING_PARAMETERS`, used only when the document doesn't
state a value):

| Parameter | Default |
|---|---|
| LD cap | 10% of contract value |
| Performance security | 10% of contract value |
| Retention per invoice | 10% of invoice amount |
| Retention cap | 5% of contract value |
| Contingency | 10% |
| Target margin | 15% |
| Invoices count | 12 |

**Rounding**: per-invoice retention is computed on **unrounded** values and
rounded once for the returned totals. Rounding each installment before summing
across 12 invoices left the total $0.04 short of the cap.

---

## 🔑 Key Features

### 1. LLM integration

**Python** (`python/models/factory.py`) — `get_model(provider, model)` returns a
LangChain `BaseChatModel`. Supported: `openai`, `google`, `anthropic`,
`openrouter`, `moonshot`. OpenRouter and Moonshot are OpenAI-compatible and reuse
`langchain-openai`.

Model resolution order per agent (`python/graph/pipeline.py::_resolve_model`):
1. Explicit per-agent override (set via `/api/admin/models`)
2. Request-level provider/model
3. `DEFAULT_LLM_PROVIDER` env var (defaults to `anthropic`)

**TypeScript** (`lib/llm/`) — `callLLM()` with automatic failover:

```typescript
const response = await callLLM({
  system_prompt: enrichedPrompt,
  user_message: documentText,
  max_tokens: 2048,
  temperature: 0.7,
  timeout_ms: 30000,
  retry_count: 2,
});
```

Default provider is **OpenRouter** (`google/gemini-2.0-flash-001`). Credentials
for every configured provider are loaded, so any provider with a key set is
available as a failover target.

### 2. Agent tools (Python only)

Built by `python/agents/nodes.py::_tools_for`:

- **`get_company_context`** — always offered. On-demand lookup of curated
  policies and standards uploaded by an admin via the Company Context page.
- **`extract_document_text`** — offered **only** when the agent has no routed
  text in its prompt. Offering it when the content is already in the prompt led
  models to call it anyway with hallucinated document IDs, raising
  `FileNotFoundError` and failing the whole agent run.

Both are domain-scoped, so each agent's tool returns only its own slice.

### 3. Company knowledge (Python only)

`python/app/knowledge.py` embeds each completed assessment and indexes it in
pgvector. On a later analysis, `retrieve_domain_context()` pulls the most similar
chunks from **other** bids and injects them into the agent's system prompt.

### 4. Agent memory (both pipelines)

File-based, persisted to `memory/agents/*.json` (gitignored). **Both pipelines
share the same on-disk store** — `python/app/memory.py` is a port of
`lib/memory/manager.ts` + `injector.ts` pointing at the same repo-root directory.

```typescript
const enrichedPrompt = await injector.injectMemoryContext(basePrompt, 'legal', documentText);
// ... call LLM ...
await injector.extractAndSaveMemory('legal', llmResponse.content, bidId, docType);
```

In the Python pipeline each agent applies **both** layers, in order
(`agents/nodes.py`): `inject_memory_context()` first, then `_inject_knowledge()`
for pgvector retrieval.

### 5. Citation validation

All LLM agents are prompted to cite every extracted fact.

```
[page:N, section:NAME]   ← Full citation
[page N, NAME]           ← Simplified format
[pN, NAME]               ← Very short format
[page N]                 ← Page only
```

Examples:
```
"Payment is due within 30 days [page:5, section:2.2]"
"Retention is 5% holdback [page:2]"
"Warranty period: 12 months [p8, Clause 5.2]"
```

On the TypeScript side, `validateCitations()` returns a coverage report and the
agent sets `citations_valid`. A failed check is **logged, not thrown** — the
assessment is still returned with `citations_valid: false`.

⚠️ Citation *validation* is **not ported to Python**. The live pipeline prompts
for citations and carries them inline in the assessment text, but performs no
coverage check — `lib/citation-tracker.ts` has no Python equivalent. Python has
only `strip_citation()` / `_strip_citations()` helpers for display.

### 6. Error handling

Each agent catches its own failures and returns a fallback assessment rather than
propagating. The risk agent detects failed agents and returns
`MANUAL_REVIEW_REQUIRED` instead of scoring an incomplete run.

---

## 🚀 API Integration

### POST `/api/analyze`

In Next.js this is a **thin proxy** to the Python service — the request and
response shapes are deliberately identical between the two backends so no
translation is needed.

**Request**:
```json
{
  "fileName": "contract.pdf",
  "extractedText": "[Full document text]"
}
```

**Response** (happy path, provider calls succeeding):
```json
{
  "id": "bid-123456",
  "fileName": "contract.pdf",
  "classification": { "doc_type": "CONTRACT", "confidence": 0.95 },
  "legalAssessment": {
    "compliance_issues": ["..."],
    "contract_terms": ["..."],
    "risks": ["..."],
    "overall_assessment": "YELLOW: ...",
    "citations_valid": true,
    "provider_used": "openrouter"
  },
  "engineeringAssessment": {
    "scope_analysis": ["..."],
    "structural_concerns": ["..."],
    "timeline_estimate": "24 weeks",
    "feasibility": "MEDIUM: ...",
    "citations_valid": true,
    "provider_used": "openrouter"
  },
  "accountingAssessment": {
    "cost_analysis": ["..."],
    "payment_terms": ["..."],
    "qualification_requirements": ["..."],
    "cash_flow_analysis": "...",
    "citations_valid": true,
    "provider_used": "openrouter",
    "total_estimated_cost": 473000
  },
  "riskAssessment": {
    "risk_score": 0.52,
    "risk_level": "MEDIUM",
    "risk_factors": ["..."],
    "mitigation_strategies": ["..."],
    "recommendation": "PROCEED_WITH_CAUTION",
    "recommendation_rationale": "...",
    "aggregated_findings": "...",
    "contract_summary": "...",
    "bid_decision": "YES"
  },
  "pricingBreakdown": {
    "contract_value": 12500000,
    "ld_cap_amount": 625000,
    "performance_security_amount": 1250000,
    "total_retention_held": 625000,
    "total_lockup": 1875000,
    "assumptions_used": ["..."]
  },
  "bidRecommendation": {
    "estimated_cost": 473000,
    "bid_margin_percentage": 15.0,
    "recommended_bid_price": 543950,
    "profit_amount": 70950,
    "pricing_strategy_rationale": "...",
    "ld_cap_amount": 625000,
    "performance_security_amount": 1250000,
    "total_lockup": 1875000,
    "risk_level": "MEDIUM",
    "recommendation": "PROCEED_WITH_CAUTION",
    "recommendation_rationale": "...",
    "bid_decision": "YES",
    "confidence_score": 0.68,
    "agent_timings_ms": { "orchestrator_ms": 850, "legal_ms": 6200, "engineering_ms": 5900, "accounting_ms": 6400, "risk_ms": 1 }
  }
}
```

`pricingBreakdown` (`lib/pricing-engine.ts` / `python/app/pricing_engine.py`) has
more fields than shown — see the **Pricing Engine** section above for the full
`PricingBreakdown` shape. `accountingAssessment` gains
`material_costs`, `labor_costs`, `contingency_percentage`, and
`boq_breakdown[]` (Python only) whenever the LLM's own assessment doesn't
produce a `total_estimated_cost` — filled in server-side from the admin BOQ
defaults (`GET/POST /api/admin/boq`) rather than left empty.

**Verified response** (2026-08-23, no LLM key configured — this is the actual
failure path, run for real against a local Postgres): every domain agent
failed at the provider-call step (`"provider_used": "error"`), and the risk
agent correctly detected this and returned
`"bid_decision": "MANUAL_REVIEW"`, `"recommendation": "MANUAL_REVIEW_REQUIRED"`,
`"risk_score": null`, `"risk_level": "UNKNOWN"`, with `bidRecommendation`'s
`recommended_bid_price` and `confidence_score` both `null` rather than a
number that would look real but isn't. The result still persisted to Postgres
with a real UUID and appeared on a subsequent `GET /api/bids`. This confirms
the manual-review path in the **Risk Agent (deterministic)** section above is
not just documented but actually wired up end-to-end.

---

## 🧪 Testing

The root `test-*.ts` scripts exercise the **TypeScript** pipeline only — they do
not test the live Python path.

There is no `test` script in `package.json` and neither `ts-node` nor `tsx` is a
declared dependency, so run them ad hoc with `npx`:

Verified locally on 2026-08-23: `test-pricing-engine.ts` passes all 22
assertions, and `npm run build` completes with zero TypeScript errors. The
TS agent scripts below were not run — they need live provider credentials.

Separately, the **live Python pipeline was run for real** against a local
Postgres (`scripts/local-postgres.sh`, no API key set) — see
[§ API Integration](#-api-integration) above for what that confirmed.

```bash
npx tsx test-pricing-engine.ts       # 22 assertions, pure math, no API keys needed
npx tsx test-legal-agent.ts          # single agent, needs an LLM key
npx tsx test-reference-tender.ts     # end-to-end, EBTSL 7187
npx tsx test-tender-strong-bid.ts    # expects LOW risk / PROCEED
npx tsx test-tender-moderate-risk.ts # expects MEDIUM risk / PROCEED_WITH_CAUTION
npx tsx test-tender-high-risk.ts     # expects HIGH risk / DO_NOT_PROCEED
```

`lib/test-utils/run-tender-scenario.ts` is the shared harness for the three
scenario scripts.

**Reference tender (EBTSL 7187-EBTSL-0001)** — $12.5M contract, 0.5%/week LD
capped at 5%, 10% performance security, 5% retention. Expected:

- Risk level: MEDIUM
- Recommendation: PROCEED_WITH_CAUTION
- Key issue: experience qualification gap, mitigable via JV

---

## ⚙️ Configuration

### Python (live pipeline)

```bash
DATABASE_URL=postgresql://...      # required; needs the pgvector extension
DEFAULT_LLM_PROVIDER=anthropic     # default when an agent has no override

OPENAI_API_KEY     / OPENAI_DEFAULT_MODEL
GOOGLE_API_KEY     / GOOGLE_DEFAULT_MODEL
ANTHROPIC_API_KEY  / ANTHROPIC_DEFAULT_MODEL
OPENROUTER_API_KEY / OPENROUTER_DEFAULT_MODEL
MOONSHOT_API_KEY   / MOONSHOT_DEFAULT_MODEL

OPENAI_EMBEDDING_MODEL
OPENROUTER_EMBEDDING_MODEL

LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=tendermind
```

### TypeScript (legacy pipeline)

```bash
LLM_PROVIDER=openrouter            # default; also "tokenrouter" or "anthropic"

OPENROUTER_API_KEY=...
OPENROUTER_ENDPOINT=https://openrouter.ai/api/v1
OPENROUTER_MODEL=google/gemini-2.0-flash-001

TOKENROUTER_API_KEY=...
ANTHROPIC_API_KEY=...

LLM_TIMEOUT_MS=30000
LLM_MAX_RETRIES=2
PYTHON_BACKEND_URL=http://localhost:8000
```

Authoritative list: `ENV_VAR_DOCS` in `lib/llm/config.ts`.

### Agent tuning

- **Python prompts**: `python/agents/prompts.py`
- **TypeScript prompts**: the `*_SYSTEM_PROMPT` constant at the top of each
  `lib/agents/*.ts` file
- **Per-agent model**: the `/admin/models` page, or `POST /api/admin/models`

---

## 🛠️ Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Failed to reach analysis backend" | Python server not running | `uvicorn app.main:app --port 8000` |
| "No LLM provider configured" | Missing API keys | Add to `.env.local` |
| `getLLMConfig()` throws on start | Selected `LLM_PROVIDER` has no key | Set that key or change the provider |
| `FileNotFoundError` in an agent run | Model called `extract_document_text` with a bad id | Check `_tools_for` gating in `agents/nodes.py` |
| Everything scores 0.55-0.70 | Agents not leading with a rating word | Assessments must start with GREEN/YELLOW/RED or HIGH/MEDIUM/LOW |
| `MANUAL_REVIEW_REQUIRED` returned | One or more agents failed | Check logs for the failing agent |
| "Citations incomplete" | LLM omitted citations | Lower temperature, or tighten the prompt |
| "Memory not persisting" (TS only) | Directory permissions | `chmod 755 memory/agents/` |
| "PDF contained no extractable text" | Scanned PDF, no text layer | OCR first - the extractor does not OCR |

### Tracing

With `LANGCHAIN_TRACING_V2=true` and a `LANGCHAIN_API_KEY`, every node run is
traced to LangSmith (`python/agents/tracing.py`). Confirm it is on:

```bash
curl http://localhost:8000/api/health
# → {"status":"ok","tracing_enabled":true}
```

---

## 📚 Related Documentation

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - migration state, remaining work
- [LEGAL_AGENT_GUIDE.md](./LEGAL_AGENT_GUIDE.md) - legal agent detail
- [MEMORY_SYSTEM_GUIDE.md](./MEMORY_SYSTEM_GUIDE.md) - TypeScript agent memory
- [python/README.md](./python/README.md) - Python backend
