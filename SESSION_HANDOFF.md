# Tendermind MVP - Session Handoff Document

> # ⚠️ SUPERSEDED — HISTORICAL RECORD
>
> This is a snapshot of one development session, not a description of the
> current system. **Everything it lists as "NOT Complete" has since been
> built**, and several of its instructions no longer work (see
> [Corrections](#corrections-to-this-document) below).
>
> For current state, read instead:
> - [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) — what exists now
> - [AGENTS_COMPLETE_GUIDE.md](./AGENTS_COMPLETE_GUIDE.md) — agent architecture
> - [QUICKSTART.md](./QUICKSTART.md) — how to run it
>
> Kept for the record of decisions made and why.

## Corrections to this document

Do not follow these parts — they were accurate at the time or never were:

| In this doc | Reality now |
|---|---|
| "What's NOT Complete: four agents, pricing engine, reference testing" | All built. Plus a Python/LangGraph pipeline that supersedes the TypeScript agents entirely |
| `cd /Users/umasankar/Documents/ai-hackathon` | A path on one contributor's machine. Use your own checkout |
| `POSTGRES_URLPGSQL` | Not a real variable. The Python backend reads `DATABASE_URL`; the TS side uses `@vercel/postgres` |
| `.env.example ✅ Template` | No env template is committed anywhere — `.env*` is gitignored |
| `cp .env.local .env.local.backup` | Copies real secrets around; create `.env.local` by hand instead |
| "PDF Extraction: currently uses mock text" | Real extraction via `pdf-parse` / `pypdf`. Scanned PDFs without OCR are rejected |
| "TokenRouter primary, Anthropic fallback" | Default is now **OpenRouter** in TypeScript, and `DEFAULT_LLM_PROVIDER` (default `anthropic`) in Python |
| `npm run lint`, `npm run test`, `npm run db:setup`, `npm run memory:*` | None of these scripts exist. `package.json` has only `dev`, `build`, `start` |
| "Provider timeout: 30 seconds" | The legal agent uses `timeout_ms: 120000` |
| Project structure tree | Predates `lib/agents/*`, `lib/pricing-engine.ts`, `python/`, the admin pages, auth, and the extra components |
| "Approx. Tokens Used: ~6,000" | Session bookkeeping, not project information |

Note the `throw new Error()` on failed citation validation in the Priority 1
sketch below was **not** how it shipped — the implemented agents log the
coverage warning and return the assessment with `citations_valid: false`.

---

# Historical record (August 22, session snapshot)

## 🎯 Current State Summary

### What's Complete ✅

**Phase 0: Agent Memory System** (2-3 hours)
- File-based persistent memory for agents
- Auto-injection of learnings into prompts
- Memory manager with full CRUD operations
- Memory injector with ranking and extraction
- 100% ready for agent integration

**Phase 1: LLM Provider Abstraction** (4-5 hours)
- Multi-provider support: TokenRouter (primary) + Anthropic (fallback)
- Automatic failover on provider errors
- Exponential backoff retry logic
- Provider metrics tracking
- Configuration management via environment variables
- Citation extraction from LLM responses
- 100% ready for agents to use

**Phase 2: Database & Citation Infrastructure** (1-2 hours)
- Enhanced Postgres schema with citations table
- Extracted clauses table for detailed citations
- LLM provider tracking
- Processing time metrics
- Database indices for optimization

**Infrastructure Files Created**:
```
lib/llm/
  ├── types.ts           (Interfaces)
  ├── tokenrouter.ts     (TokenRouter + Qwen 3.8)
  ├── anthropic.ts       (Anthropic Claude fallback)
  ├── factory.ts         (Provider factory & fallback logic)
  ├── config.ts          (Configuration management)
  └── index.ts           (Module exports)

lib/memory/
  ├── types.ts           (Memory interfaces)
  ├── manager.ts         (File-based persistence)
  ├── injector.ts        (Prompt injection & extraction)
  └── index.ts           (Module exports)

lib/
  ├── citation-tracker.ts (Citation validation)
  ├── db.ts              (Updated schema)
  └── pdf.ts             (Existing - working)

.env.local              (Updated with LLM config)
```

### What's NOT Complete ❌

**Phase 2: Four Specialized Agents** (~16-20 hours)
- Legal Agent
- Engineering Agent
- Accounting Agent
- Risk Agent

**Phase 3: Deterministic Pricing Engine** (~6-8 hours)

**Phase 4: Reference Tender Testing** (~4-6 hours)

---

## 📋 Quick Start for Next Session

### 1. Environment Setup
```bash
cd /Users/umasankar/Documents/ai-hackathon

# Copy template if needed
cp .env.local .env.local.backup

# Add your API keys to .env.local:
# LLM_PROVIDER=tokenrouter
# TOKENROUTER_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here (optional)
```

### 2. Verify Everything Works
```bash
npm install
npm run build  # Should complete with no TypeScript errors
npm run dev    # Start dev server on localhost:3000
```

### 3. Test LLM Integration
```bash
# Create a test file to verify LLM setup works:
# lib/test-llm.ts

import { callLLM } from '@/lib/llm';
import { getMemoryInjector } from '@/lib/memory';

async function test() {
  const response = await callLLM({
    system_prompt: "Test prompt",
    user_message: "Hello",
  });
  console.log('LLM Provider:', response.provider_used);
  console.log('Success:', !!response.content);
}

test().catch(console.error);
```

---

## 🔧 Core APIs Reference

### LLM Provider Access
```typescript
import { callLLM, getLLMFactory } from '@/lib/llm';

// Call LLM (automatically uses configured provider + fallback)
const response = await callLLM({
  system_prompt: "Your system message",
  user_message: "Your user message",
  max_tokens: 2048,
  temperature: 0.7,
  timeout_ms: 30000,
  retry_count: 2,
});

// Get provider metrics
const metrics = getLLMFactory().getMetrics();
console.log(metrics.primary.calls);      // TokenRouter call count
console.log(metrics.fallback.calls);     // Anthropic fallback count
```

### Memory System Access
```typescript
import { getMemoryManager, getMemoryInjector } from '@/lib/memory';

// Manager: Direct memory access
const manager = getMemoryManager();
const memories = await manager.searchMemories({ agent: 'legal', limit: 5 });
await manager.saveMemory(memory);
await manager.deleteMemory(memoryId);

// Injector: Prompt injection & learning extraction
const injector = getMemoryInjector();
const enrichedPrompt = await injector.injectMemoryContext(basePrompt, 'legal', documentText);
const memoryId = await injector.extractAndSaveMemory('legal', response, bidId, docType);
```

### Citation Tracking
```typescript
import { validateCitations, getCitationStats } from '@/lib/citation-tracker';

const report = validateCitations(facts);
console.log(report.is_compliant);           // true/false (100% citation required)
console.log(report.citation_coverage_percent); // 0-100

const stats = getCitationStats(facts);
console.log(stats.pages_with_citations);    // Which pages are cited
```

### Database Operations
```typescript
import { saveBid, getBids, getBidById, getClausesForBid } from '@/lib/db';

const bid = await saveBid({
  file_name: 'contract.pdf',
  doc_type: 'CONTRACT',
  extracted_text: '...',
  classification_confidence: 0.85,
  legal_assessment: {...},
  engineering_assessment: {...},
  accounting_assessment: {...},
  pricing_breakdown: {...},
  risk_score: 0.65,
  risk_factors: {...},
  recommendation: {...},
  llm_provider_used: 'tokenrouter',
  processing_time_ms: 5234,
});

const allBids = await getBids(50, 0);  // limit, offset
const bidDetail = await getBidById(bidId);
const citations = await getClausesForBid(bidId);
```

---

## 📁 Project Structure

```
ai-hackathon/
├── app/
│   ├── api/
│   │   ├── upload/route.ts          ✅ Works (unchanged)
│   │   ├── analyze/route.ts         ✅ Updated for new schema
│   │   ├── bids/route.ts            ✅ Works (unchanged)
│   │   └── bid/[id]/route.ts        ✅ Works (unchanged)
│   ├── bids/page.tsx                ✅ Works (unchanged)
│   ├── bid/[id]/page.tsx            ✅ Works (unchanged)
│   ├── page.tsx                     ✅ Works (unchanged)
│   ├── layout.tsx                   ✅ Works (unchanged)
│   └── globals.css                  ✅ Works (unchanged)
│
├── components/
│   ├── UploadForm.tsx               ✅ Works (unchanged)
│   └── ResultsView.tsx              ✅ Works (unchanged)
│
├── lib/
│   ├── llm/
│   │   ├── types.ts                 ✅ NEW
│   │   ├── tokenrouter.ts           ✅ NEW
│   │   ├── anthropic.ts             ✅ NEW
│   │   ├── factory.ts               ✅ NEW
│   │   ├── config.ts                ✅ NEW
│   │   └── index.ts                 ✅ NEW
│   │
│   ├── memory/
│   │   ├── types.ts                 ✅ NEW
│   │   ├── manager.ts               ✅ NEW
│   │   ├── injector.ts              ✅ NEW
│   │   └── index.ts                 ✅ NEW
│   │
│   ├── agents/
│   │   └── mock-agents.ts           ✅ Existing (to be replaced)
│   │
│   ├── citation-tracker.ts          ✅ NEW
│   ├── classifier.ts                ✅ Existing (to be upgraded)
│   ├── db.ts                        ✅ UPDATED (new schema)
│   └── pdf.ts                       ✅ Existing (working)
│
├── memory/
│   └── agents/
│       ├── mem_*.json               (Auto-created by memory manager)
│
├── .env.local                       ✅ UPDATED (LLM config)
├── .env.example                     ✅ Template
├── package.json                     ✅ Working (no new packages)
├── tsconfig.json                    ✅ Working
├── next.config.ts                   ✅ Working
│
├── IMPLEMENTATION_STATUS.md         ✅ Updated
├── MEMORY_SYSTEM_GUIDE.md          ✅ NEW - Comprehensive guide
├── DEPLOYMENT.md                    ✅ Existing
├── QUICKSTART.md                    ✅ Existing
└── README.md                        ✅ Existing
```

---

## 🚀 Next Steps (Detailed for Next Session)

### IMMEDIATE: Phase 2 - Agent Implementation

**Priority 1: Implement Legal Agent** (4-5 hours)
```typescript
// File: lib/agents/legal-agent.ts
// Should:
// 1. Import callLLM and getMemoryInjector
// 2. Define specialized system prompt
// 3. Inject memory context before LLM call
// 4. Extract citations from response
// 5. Validate 100% citation coverage
// 6. Save learnings to memory
// 7. Return structured legal assessment

import { callLLM } from '@/lib/llm';
import { getMemoryInjector } from '@/lib/memory';
import { validateCitations } from '@/lib/citation-tracker';

const LEGAL_AGENT_PROMPT = `You are a construction contract expert...`;

export async function legalAgent(documentText: string, bidId: string) {
  const injector = getMemoryInjector();

  // Inject memory
  const enrichedPrompt = await injector.injectMemoryContext(
    LEGAL_AGENT_PROMPT,
    'legal',
    documentText
  );

  // Call LLM
  const response = await callLLM({
    system_prompt: enrichedPrompt,
    user_message: documentText,
  });

  // Validate citations
  const facts = extractLegalFacts(response.content);
  const validation = validateCitations(facts);
  if (!validation.is_compliant) {
    throw new Error(`Citations incomplete: ${validation.citation_coverage_percent}%`);
  }

  // Save learnings
  await injector.extractAndSaveMemory(
    'legal',
    response.content,
    bidId,
    'CONTRACT'
  );

  return { findings: facts, provider: response.provider_used };
}
```

**Priority 2-4: Implement remaining agents** (3-4 hours each)
- Engineering Agent: Scope, timeline, site conditions
- Accounting Agent: Qualifications, payment terms
- Risk Agent: Aggregation and verdicts

### THEN: Phase 3 - Pricing Engine (~6-8 hours)

File: `lib/pricing-engine.ts`

Key calculations (NO LLM):
```typescript
// LD Exposure
const ld_cap = contract_price * 0.10;  // 1% per week, capped at 10%

// Performance Security
const security = contract_price * 0.10;

// Retention
const retention = Math.min(
  invoice_amount * 0.10,      // 10% per RA bill
  contract_price * 0.05       // Capped at 5% of contract
);

// Total Lock-up
const total_lockup = security + retention;
```

### THEN: Phase 4 - Reference Tender Testing (~4-6 hours)

Test with EBTSL 7187-EBTSL-0001:
```
Expected Output:
CONDITIONAL BID
- Financial criteria: MET
- Experience: NOT MET (closeable via JV)
- LD Cap: 10%
- Recommendation: Pursue with JV partner
```

---

## 🔐 Security Notes

- **API Keys**: Never commit `.env.local` - use `.env.local.example`
- **Memory Files**: `memory/` directory is local, not synced
- **Database**: Requires `POSTGRES_URLPGSQL` env var (not set locally by default)
- **Fallback**: Always verify ANTHROPIC_API_KEY is set for production reliability

---

## 📊 Performance Targets (from PRD)

- Analysis time: < 10 minutes (demo) / < 5 minutes (v2)
- Citation coverage: 100% (non-negotiable)
- Provider switching: < 100ms fallback time
- Memory search: < 200ms for 100 memories

---

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run linting (if configured)

# Testing (add when ready)
# npm run test          # Run unit tests

# Database
# npm run db:setup      # Initialize database schema

# Memory management
# npm run memory:export # Export all memories
# npm run memory:clean  # Archive old memories
```

---

## 📖 Documentation Files

**For Reference:**
- `MEMORY_SYSTEM_GUIDE.md` - How memory system works and how to use it
- `IMPLEMENTATION_STATUS.md` - Detailed implementation breakdown
- `DEPLOYMENT.md` - How to deploy to Vercel
- `QUICKSTART.md` - 5-minute setup guide
- `README.md` - Project overview

---

## ⚠️ Known Issues & Limitations

1. **PDF Extraction**: Currently uses mock text (placeholder for Claude API integration)
2. **Citation Patterns**: Regex-based extraction works for standard formats only
3. **Provider Timeout**: 30 seconds - may need adjustment for 500+ page documents
4. **Memory Storage**: File-based only - no remote backup yet
5. **Database**: Requires external Postgres - not included in free tier setup

---

## 🎓 Key Decisions Made

1. **TokenRouter Primary**: Qwen 3.8 Max Free = cost-effective, suitable for structured extraction
2. **Anthropic Fallback**: Highest quality, used only on errors
3. **File-Based Memory**: Simple, portable, no DB dependency for learning
4. **100% Citation Requirement**: Non-negotiable per PRD
5. **No LLM for Math**: Pricing engine must be deterministic

---

## 📞 Quick Reference

**If build fails:**
```bash
# Clean rebuild
rm -rf .next node_modules
npm install
npm run build
```

**If LLM not working:**
- Check `TOKENROUTER_API_KEY` in `.env.local`
- Verify endpoint: `https://api.tokenrouter.com/v1`
- Check `ANTHROPIC_API_KEY` for fallback

**If memory not persisting:**
- Verify `memory/agents/` directory exists
- Check file permissions: `chmod 755 memory/agents/`

**If database connection fails:**
- Add `POSTGRES_URLPGSQL` to `.env.local`
- Or use mock mode (current setup)

---

## 🎯 Checklist for Next Session

- [ ] Review this handoff document
- [ ] Verify build: `npm run build`
- [ ] Set API keys in `.env.local`
- [ ] Test LLM: `npm run dev` and check console
- [ ] Test memory system: Call `getMemoryManager().getMemoryStats()`
- [ ] Implement Legal Agent (Priority 1)
- [ ] Implement Engineering Agent
- [ ] Implement Accounting Agent
- [ ] Implement Risk Agent
- [ ] Build Pricing Engine
- [ ] Test with EBTSL 7187 reference tender

---

## 💾 Session Context

**Approx. Tokens Used**: ~6,000 / 15,000,000  
**Next Session**: Fresh context available for full Phase 2+ implementation  
**Build Status**: ✅ TypeScript compilation successful  
**Tests Status**: ⏳ Ready to implement (no tests added yet)  

---

**Snapshot taken**: August 22, 13:45 UTC  
**By**: Claude Code  
**For**: Next Session Developer  
**Superseded**: see the banner at the top of this file

---

*Historical session snapshot. See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for the current state of the project.*
