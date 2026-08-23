# Legal Agent Implementation Guide

> **Scope**: this guide documents the **TypeScript** legal agent
> (`lib/agents/legal-agent.ts`). That agent is the *legacy* implementation —
> `/api/analyze` now proxies to the Python/LangGraph pipeline, whose legal agent
> lives in `python/agents/nodes.py` and `python/agents/prompts.py`. The two share
> the same system prompt content and output shape, but only the Python one runs
> in the app. See [AGENTS_COMPLETE_GUIDE.md](./AGENTS_COMPLETE_GUIDE.md).

## Overview

The **Legal Agent** analyzes construction contracts and related documents for legal compliance, risk, and obligations.

**Status**: ✅ Implemented and tested (TypeScript path)

---

## What the Legal Agent Does

The Legal Agent provides structured legal analysis across 4 dimensions:

### 1. **Compliance Issues**
Identifies non-compliance with:
- Local building codes and regulations
- Industry standards (ISO practices)
- Government procurement rules
- Safety and environmental requirements

### 2. **Contract Terms**
Extracts and summarizes critical terms:
- Payment terms and milestones
- Liability clauses and caps
- Termination conditions
- Warranties and guarantees
- Dispute resolution methods

### 3. **Risks**
Identifies legal risks such as:
- Indemnification exposure
- Performance security requirements
- Liquidated damages clauses
- Warranty obligations
- Change order processes

### 4. **Overall Assessment**
Provides a go/no-go recommendation:
- **GREEN**: Acceptable as-is or with minor modifications
- **YELLOW**: Requires negotiation on specific terms
- **RED**: Significant legal risks that must be resolved

---

## Architecture

### Core Files

```
lib/agents/legal-agent.ts          ← Main agent implementation
  ├── legalAgent()                 ← Entry point function
  ├── parseAssessment()            ← Parse LLM response (JSON, text fallback)
  ├── parseArray()                 ← Coerce parsed values to string[]
  ├── extractBulletPoints()        ← Text-mode section extraction
  ├── extractAssessmentLine()      ← Pull the GREEN/YELLOW/RED line
  ├── extractFactsFromAssessment() ← Extract structured facts
  └── extractFactWithCitation()    ← Parse citations from text
```

### Callers

```
test-legal-agent.ts        → legalAgent(text, bidId, docType)
test-reference-tender.ts   → legalAgent(...) alongside the other agents
lib/test-utils/run-tender-scenario.ts
```

⚠️ `app/api/analyze/route.ts` does **not** call this function. It proxies to the
Python backend, which runs its own legal agent.

Internal flow when called:

```
legalAgent(documentText, bidId, docType)
  ├── Injects memory context (past learnings)
  ├── Calls LLM via callLLM() — OpenRouter by default, with failover
  ├── Validates citations (logs coverage; does not throw)
  └── Saves learnings to memory
```

---

## Key Features

### 🧠 Memory Integration

The agent automatically learns from past analyses:

```typescript
// Memory context is injected before LLM call
const enrichedPrompt = await injector.injectMemoryContext(
  LEGAL_AGENT_SYSTEM_PROMPT,
  'legal',
  documentText,
);

// Learnings are saved after analysis
await injector.extractAndSaveMemory(
  'legal',
  llmResponse.content,
  bidId,
  docType,
);
```

**Result**: Each analysis improves future analyses by embedding past learnings.

### 🔗 Citation Validation

**Every fact must be cited** (per PRD requirement):

```typescript
const facts = extractFactsFromAssessment(assessment);
const validation = validateCitations(facts);

if (!validation.is_compliant) {
  console.warn(`Missing ${validation.uncited_facts.length} citations`);
}
```

**Citation Format** (required in LLM output):
```
- "Retention is 10% per invoice [page:2, section:2.1]"
- "Payment due in 30 days [page:2]"
- "Warranty period is 12 months [page:5, Clause 5.3]"
```

### ⚡ Provider Failover

Automatic failover between providers. The default primary is **OpenRouter**;
any other provider with a key set is an eligible fallback:

```typescript
const response = await callLLM({
  system_prompt: enrichedPrompt,
  user_message: documentText,
  // Provider automatically selected with fallback
});

console.log(`Used provider: ${response.provider_used}`); // openrouter | tokenrouter | anthropic
```

### ⏱️ Timeout & Retry

Built-in resilience:
```typescript
const response = await callLLM({
  max_tokens: 4096,
  temperature: 0.7,
  timeout_ms: 120000,   // 2 minute timeout
  retry_count: 2,       // Retry on failure
});
```

---

## How to Use

### 1. **Direct Function Call** (for testing)

```typescript
import { legalAgent } from '@/lib/agents/legal-agent';

const assessment = await legalAgent(
  documentText,           // Full document text
  'bid-12345',            // Unique bid ID
  'CONTRACT'              // Document type
);

console.log(assessment.compliance_issues);
console.log(assessment.contract_terms);
console.log(assessment.risks);
console.log(assessment.overall_assessment);
console.log(assessment.provider_used); // 'openrouter' | 'tokenrouter' | 'anthropic'
```

### 2. **API Integration** (production)

⚠️ `/api/analyze` returns a `legalAssessment` in the shape below, but it is
produced by the **Python** legal agent, not by `lib/agents/legal-agent.ts`:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "contract.pdf",
    "extractedText": "CONSTRUCTION CONTRACT...[full text]"
  }'
```

**Response includes**:
```json
{
  "legalAssessment": {
    "compliance_issues": ["..."],
    "contract_terms": ["..."],
    "risks": ["..."],
    "overall_assessment": "...",
    "citations_valid": true,
    "provider_used": "openrouter"
  }
}
```

### 3. **Test with Sample**

Run the included test script:

```bash
npx tsx test-legal-agent.ts
```

This tests the agent with a sample contract and shows:
- All extracted findings
- Provider used (tokenrouter or anthropic)
- Citations validation status
- Processing time

---

## Understanding the Output

### Assessment Structure

```typescript
interface LegalAssessment {
  compliance_issues: string[];    // List of non-compliance findings
  contract_terms: string[];       // Critical terms extracted
  risks: string[];                // Legal risks identified
  overall_assessment: string;     // GREEN/YELLOW/RED recommendation
  citations_valid?: boolean;      // 100% citations present?
  provider_used?: string;         // Which LLM provider was used
}
```

### Example Output

```
COMPLIANCE ISSUES:
  1. Payment terms need clarification [page:2, section:2.1]
  2. Liability clause is one-sided [page:3, section:3.1]

CONTRACT TERMS:
  1. 30-day payment terms with 10% retention [page:2]
  2. Binding arbitration for disputes [page:7, section:7.2]

RISKS:
  1. Indemnification exposure is unlimited [page:3, section:3.2]
  2. Force majeure clause is overly restrictive [page:6]

OVERALL ASSESSMENT:
  YELLOW: Requires negotiation on liability caps and force majeure terms [page:1]

CITATIONS VALID: ✅ Yes (100% coverage)
PROVIDER USED: openrouter
```

---

## Error Handling

### If LLM is unavailable:

```typescript
// Primary provider fails → Factory fails over to another configured provider
// All fail → Returns error assessment with fallback data
const assessment = await legalAgent(text, bidId, docType);

if (assessment.provider_used === 'error') {
  // Handle error - assessment contains placeholder data
  console.log('Manual review required');
}
```

### If citation validation fails:

```typescript
if (!assessment.citations_valid) {
  console.warn('⚠️  Some facts are not cited');
  console.warn('Manual review recommended');
}
```

### If memory save fails:

Memory save failures don't break the analysis - they're logged but don't prevent the result from being returned.

---

## Configuration

### Environment Variables

Set these in `.env.local`:

```bash
# LLM Provider selection
LLM_PROVIDER=openrouter     # default; also 'tokenrouter' or 'anthropic'

# OpenRouter (default primary)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_ENDPOINT=https://openrouter.ai/api/v1
OPENROUTER_MODEL=google/gemini-2.0-flash-001

# TokenRouter
TOKENROUTER_API_KEY=sk_...
TOKENROUTER_ENDPOINT=https://api.tokenrouter.com/v1

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

The selected `LLM_PROVIDER` must have its key set or `getLLMConfig()` throws.
Authoritative list: `ENV_VAR_DOCS` in `lib/llm/config.ts`.

### Agent Tuning

Modify these in `lib/agents/legal-agent.ts`:

```typescript
// System prompt (top of file)
const LEGAL_AGENT_SYSTEM_PROMPT = `...`

// LLM parameters (in legalAgent function)
const response = await callLLM({
  max_tokens: 4096,        // Adjust for longer outputs
  temperature: 0.7,        // 0.0 = deterministic, 1.0 = creative
  timeout_ms: 120000,      // Increase further for very large documents
  retry_count: 2,          // Number of retries
});
```

---

## Performance

### Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Analysis time | < 30s | ~8-12s (varies by provider/model) |
| Citation coverage | 100% | ✅ Validated |
| Provider failover | < 100ms | ~50-80ms |
| Memory search | < 200ms | ~100-150ms |

### Optimization Tips

1. **Reduce document length**: Truncate to first 10,000 words if possible
2. **Increase temperature**: 0.5-0.9 for more diverse findings
3. **Cache memories**: Filter by document type to reduce search load
4. **Batch requests**: Process multiple documents in parallel

---

## Integration with Other Agents

All downstream components are now implemented:

| Phase | Component | Status | Depends On |
|-------|-----------|--------|-----------|
| 2.1 | Legal Agent | ✅ Done | LLM + Memory |
| 2.2 | Engineering Agent | ✅ Done | Legal Agent |
| 2.3 | Accounting Agent | ✅ Done | Legal Agent |
| 2.4 | Risk Agent | ✅ Done | All others |
| 3 | Pricing Engine | ✅ Done | All agents |
| 4 | Reference Testing | ✅ Done | All above |
| 5 | Python/LangGraph port | ✅ Done | — (now the live path) |

---

## Debugging

### Enable detailed logging:

The agent logs at each step:
```
[Legal Agent] Starting analysis for bid bid-12345, document type: CONTRACT
[Legal Agent] Memory context injected
[Legal Agent] LLM response received from tokenrouter
[Legal Agent] Citation validation: 100% coverage
[Legal Agent] Learnings saved to memory
[Legal Agent] Analysis complete
```

### Check server logs:

```bash
npm run dev          # TypeScript agent logs appear in this terminal
```

The live Python agent logs to the `uvicorn` terminal instead, and traces to
LangSmith when `LANGCHAIN_TRACING_V2=true`.

### Common issues:

**Issue**: "No LLM provider configured"
- **Fix**: Check `.env.local` has a key for whichever provider `LLM_PROVIDER` names
  (`OPENROUTER_API_KEY` by default)

**Issue**: "Citations incomplete"
- **Fix**: Agent tried but LLM didn't include citations. Retry with different temperature or prompt.

**Issue**: "Memory not persisting"
- **Fix**: Check `memory/agents/` directory exists and is writable: `chmod 755 memory/agents/`

---

## Testing

### Unit test the agent:

```typescript
import { legalAgent } from '@/lib/agents/legal-agent';

it('should analyze contract and extract terms', async () => {
  const result = await legalAgent(contractText, 'test-1', 'CONTRACT');
  
  expect(result.compliance_issues).toBeDefined();
  expect(result.contract_terms.length).toBeGreaterThan(0);
  expect(result.overall_assessment).toMatch(/GREEN|YELLOW|RED/);
  expect(result.citations_valid).toBe(true);
});
```

### E2E test via API:

Note this exercises the **Python** legal agent, not `lib/agents/legal-agent.ts`.
The Python backend must be running on port 8000.

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.txt",
    "extractedText": "CONSTRUCTION CONTRACT..."
  }' | jq '.legalAssessment'
```

---

## Next Steps

All the agents this document once listed as upcoming are now built. What remains
is deciding this implementation's future:

1. ✅ Legal, Engineering, Accounting, Risk agents — all implemented
2. ✅ Pricing engine and reference testing — implemented
3. ✅ Python/LangGraph port — now the live path
4. 🔄 **Decide whether `lib/agents/legal-agent.ts` stays.** It is duplicated by
   `python/agents/nodes.py::legal_agent`. Keeping both means two prompts to
   maintain in step.

---

## Reference

- **Session Handoff**: [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- **Memory System**: [MEMORY_SYSTEM_GUIDE.md](MEMORY_SYSTEM_GUIDE.md)
- **LLM Infrastructure**: [lib/llm/](lib/llm/)
- **Citation Tracker**: [lib/citation-tracker.ts](lib/citation-tracker.ts)

---

**Last Updated**: 2026-08-22  
**Status**: Implemented; superseded in production by the Python agent
