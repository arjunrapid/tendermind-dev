# Agent Memory System Guide

> **Scope**: this guide documents the TypeScript implementation (`lib/memory/`),
> but the store itself is **shared by both pipelines**. `python/app/memory.py` is
> a port of `manager.ts` + `injector.ts` that reads and writes the same repo-root
> `memory/agents/*.json` files, and the live Python agents call it on every run.
> Python additionally layers pgvector company-knowledge retrieval
> (`python/app/knowledge.py`) on top of it. See
> [AGENTS_COMPLETE_GUIDE.md](./AGENTS_COMPLETE_GUIDE.md).

## Overview

The Agent Memory System persists learnings from previous tender analyses and automatically injects relevant context into agent prompts. This improves agent performance over time without requiring manual configuration.

**Benefits:**
- ✅ Agents learn from previous analyses
- ✅ Faster and more accurate responses
- ✅ Consistent patterns across tenders
- ✅ Automatic contextualization
- ✅ File-based persistence (no database required)

## Architecture

```
Analysis Phase 1
      ↓
Agent response
      ↓
Extract key learnings
      ↓
Save to memory/agents/*.json
      ↓
  
Analysis Phase 2
      ↓
Load relevant memories
      ↓
Inject into agent prompt
      ↓
Agent uses memories for context
      ↓
Extract new learnings → repeat
```

## File Structure

```
memory/
  agents/
    mem_1692720485_abc123def.json  (Legal Agent memory)
    mem_1692720496_xyz789uvw.json  (Engineering Agent memory)
    mem_1692720501_pqr456stu.json  (Accounting Agent memory)
    ...
```

Each memory file contains:
```json
{
  "id": "mem_1692720485_abc123def",
  "type": "clause_extraction",
  "agent": "legal",
  "content": "LD caps typically range from 5-15% of contract value...",
  "metadata": {
    "source_bid_id": "bid_12345",
    "source_document": "CONTRACT",
    "confidence": 0.85,
    "tags": ["legal", "LD", "risk"],
    "created_at": "2026-08-22T10:30:00Z",
    "updated_at": "2026-08-22T10:30:00Z",
    "usage_count": 3,
    "last_used": "2026-08-22T11:45:00Z"
  }
}
```

## Usage in Agents

### Basic Pattern: Inject Memory Context

```typescript
import { getMemoryInjector } from '@/lib/memory';
import { callLLM } from '@/lib/llm';

export async function legalAgent(documentText: string) {
  const injector = getMemoryInjector();

  // Step 1: Inject memory context into prompt
  const systemPromptWithMemory = await injector.injectMemoryContext(
    LEGAL_AGENT_PROMPT,
    'legal',
    documentText
  );

  // Step 2: Call LLM with enriched prompt
  const response = await callLLM({
    system_prompt: systemPromptWithMemory,
    user_message: documentText,
    max_tokens: 2048,
  });

  // Step 3: Extract and save learnings for future use
  const memoryId = await injector.extractAndSaveMemory(
    'legal',
    response.content,
    bidId,
    'CONTRACT'
  );

  return {
    findings: parseLegalResponse(response.content),
    memory_id: memoryId,
    provider: response.provider_used,
  };
}
```

### Advanced: Custom Memory Search

```typescript
import { getMemoryManager } from '@/lib/memory';

export async function engineeringAgent(documentText: string) {
  const manager = getMemoryManager();

  // Search for specific memory patterns
  const relevantMemories = await manager.searchMemories({
    agent: 'engineering',
    type: 'classification',
    tags: ['timeline', 'site'],
    limit: 5,
    query: 'weather delays',
  });

  // Use memories for context
  const contextText = relevantMemories
    .map(m => `- ${m.content}`)
    .join('\n');

  const prompt = `
${ENGINEERING_AGENT_PROMPT}

## Relevant learnings from similar projects:
${contextText}
`;

  // ... continue with LLM call
}
```

## Memory Types

Each memory has a type that categorizes it:

```typescript
type MemoryType = 
  | 'clause_extraction'      // Legal clauses, terms, conditions
  | 'classification'         // Document types, patterns, categories
  | 'risk_pattern'          // Risk factors, mitigation strategies
  | 'cost_estimation'       // Cost calculations, pricing patterns
  | 'general'               // Other learnings
```

## Agent Examples

### Legal Agent with Memory

```typescript
import { getMemoryInjector } from '@/lib/memory';
import { callLLM } from '@/lib/llm';

const LEGAL_AGENT_PROMPT = `You are a construction contract expert...`;

export async function legalAgent(
  documentText: string,
  bidId: string,
  docType: string
) {
  const injector = getMemoryInjector();

  // Inject previous learnings
  const enrichedPrompt = await injector.injectMemoryContext(
    LEGAL_AGENT_PROMPT,
    'legal',
    documentText
  );

  // Call LLM with memory context
  const response = await callLLM({
    system_prompt: enrichedPrompt,
    user_message: `Analyze this ${docType}:\n\n${documentText}`,
  });

  // Extract and save learnings
  await injector.extractAndSaveMemory(
    'legal',
    response.content,
    bidId,
    docType
  );

  return parseLegalResponse(response.content);
}
```

### Engineering Agent with Memory

```typescript
import { getMemoryInjector, getMemoryManager } from '@/lib/memory';
import { callLLM } from '@/lib/llm';

const ENGINEERING_AGENT_PROMPT = `You are a civil engineering expert...`;

export async function engineeringAgent(
  documentText: string,
  bidId: string,
  docType: string
) {
  const injector = getMemoryInjector();
  const manager = getMemoryManager();

  // Get memory context
  const memoryContext = await injector.getMemoryContext(
    'engineering',
    documentText,
    5
  );

  console.log(`Using ${memoryContext.relevant_count} relevant memories`);

  // Build prompt with memory
  const prompt = `${ENGINEERING_AGENT_PROMPT}

${memoryContext.context_text}`;

  // Call LLM
  const response = await callLLM({
    system_prompt: prompt,
    user_message: `Analyze this ${docType}:\n\n${documentText}`,
  });

  // NOTE: getMemoryContext() already calls recordMemoryUsage() on every
  // memory it returns (injector.ts:30). Calling it again here double-counts.
  // Shown only to illustrate the manual API.

  await injector.extractAndSaveMemory(
    'engineering',
    response.content,
    bidId,
    docType
  );

  return parseEngineeringResponse(response.content);
}
```

## Memory Management APIs

### MemoryManager API

```typescript
import { getMemoryManager } from '@/lib/memory';

const manager = getMemoryManager();

// Get memory by ID
const memory = await manager.getMemory('mem_1692720485_abc123def');

// Search memories
const results = await manager.searchMemories({
  agent: 'legal',
  type: 'clause_extraction',
  tags: ['LD'],
  limit: 10,
  query: 'liquidated damages'
});

// Get all memories for an agent
const legalMemories = await manager.getMemoriesForAgent('legal', 20);

// Record that a memory was used
await manager.recordMemoryUsage('mem_1692720485_abc123def');

// Delete a memory
await manager.deleteMemory('mem_1692720485_abc123def');

// Export all memories
const allMemories = await manager.exportMemories();

// Get statistics (synchronous)
const stats = manager.getMemoryStats();
// Returns: { total: number, byAgent: Record<string, number>, byType: Record<string, number> }

// Save a memory directly
await manager.saveMemory(memory);

// Import memories in bulk
await manager.importMemories(memories);

// Delete every memory sourced from one bid; returns the count deleted
const deleted = await manager.deleteMemoriesForBid('bid_12345');

// Explicit initialization (all other methods call this internally)
await manager.initialize();
```

`exportMemories(agent?)` takes an optional agent filter:
`await manager.exportMemories('legal')`.

### MemoryInjector API

```typescript
import { getMemoryInjector } from '@/lib/memory';

const injector = getMemoryInjector();

// Get memory context for an agent
const context = await injector.getMemoryContext(
  'legal',
  documentText,
  5  // limit
);

// Inject memories into a prompt
const enhancedPrompt = await injector.injectMemoryContext(
  systemPrompt,
  'legal',
  documentText
);

// Extract and save learnings from a response
const memoryId = await injector.extractAndSaveMemory(
  'legal',
  agentResponse,
  bidId,
  'CONTRACT'
);
```

## Memory Quality & Lifecycle

### When Memories Are Created
Automatically after each agent runs:
1. Extract key findings from agent response
2. Generate relevant tags
3. Save to `memory/agents/*.json`

### When Memories Are Used
Before each agent runs:
1. Search for relevant memories
2. Rank by relevance to current document
3. Inject top 5 into agent prompt
4. Record usage count

### Memory Evolution
- **Usage Count**: Increases each time used
- **Last Used**: Updated when accessed
- **Confidence**: Set at creation, can be adjusted
- **Tags**: Auto-generated, can be customized

## Best Practices

### 1. **Tag Your Memories**
```typescript
// During extraction, add meaningful tags
metadata.tags = ['legal', 'LD', 'risk', 'contract-specific'];
```

### 2. **Monitor Memory Quality**
```typescript
// Periodically review low-confidence memories
const allMemories = await manager.exportMemories();
const lowQuality = allMemories.filter(m => m.metadata.confidence < 0.7);

// Delete if not useful
for (const memory of lowQuality) {
  if (memory.metadata.usage_count === 0) {
    await manager.deleteMemory(memory.id);
  }
}
```

### 3. **Export & Backup**
```typescript
// Regular exports for backup
const legalMemories = await manager.exportMemories('legal');
fs.writeFileSync('backup.json', JSON.stringify(legalMemories, null, 2));
```

### 4. **Monitor Performance**
```typescript
// Check memory effectiveness
const stats = manager.getMemoryStats();
console.log(`Legal memories: ${stats.byAgent.legal}`);
console.log(`Total usage: ${totalUsageCount}`);
```

## Memory File Examples

### Legal Memory
```json
{
  "type": "clause_extraction",
  "agent": "legal",
  "content": "LD clauses in construction contracts typically cap at 10% of contract value with 1% per week accumulation. Time-based LD is more common in EPC contracts than milestone-based.",
  "metadata": {
    "tags": ["legal", "LD", "contract"],
    "confidence": 0.92,
    "usage_count": 8
  }
}
```

### Engineering Memory
```json
{
  "type": "classification",
  "agent": "engineering",
  "content": "BOQ documents typically include unit rates with quantities calculated from drawings. Cross-reference page 2-3 and Annexure C for cost implications.",
  "metadata": {
    "tags": ["engineering", "BOQ", "cost-estimation"],
    "confidence": 0.85,
    "usage_count": 5
  }
}
```

### Risk Memory
```json
{
  "type": "risk_pattern",
  "agent": "risk",
  "content": "Weather-dependent projects in monsoon regions require 15-20% risk premium. Site access restrictions during rainy season are common.",
  "metadata": {
    "tags": ["risk", "weather", "site-conditions"],
    "confidence": 0.88,
    "usage_count": 12
  }
}
```

## Integration with Agents

### Reference Template for All Agents

```typescript
import { getMemoryInjector } from '@/lib/memory';
import { callLLM } from '@/lib/llm';

async function agentName(documentText: string, bidId: string, docType: string) {
  const injector = getMemoryInjector();

  // 1. Enrich prompt with memory
  const enrichedPrompt = await injector.injectMemoryContext(
    AGENT_SYSTEM_PROMPT,
    'agent_name',  // 'legal' | 'engineering' | 'accounting' | 'risk'
                   // (AgentMemory.agent also allows 'general')
    documentText
  );

  // 2. Call LLM with memory context
  const response = await callLLM({
    system_prompt: enrichedPrompt,
    user_message: documentText,
  });

  // 3. Extract and save learnings
  const memoryId = await injector.extractAndSaveMemory(
    'agent_name',
    response.content,
    bidId,
    docType
  );

  return {
    findings: parseResponse(response.content),
    memoryId,
    provider: response.provider_used,
  };
}
```

## Troubleshooting

### Memory Not Loading
```bash
# Check memory directory exists
ls -la memory/agents/

# Check file permissions
chmod 755 memory/agents/
chmod 644 memory/agents/*.json
```

### Memory Injector Not Working
```typescript
// Verify initialization
const injector = getMemoryInjector();
const context = await injector.getMemoryContext('legal', 'test', 1);
console.log(context);  // Should show available memories
```

### Memory Growing Too Large
```typescript
// Export old memories for archival
const allMemories = await manager.exportMemories();
const oldMemories = allMemories.filter(m => {
  const age = Date.now() - new Date(m.metadata.created_at).getTime();
  return age > 30 * 24 * 60 * 60 * 1000;  // 30 days
});

// Archive and delete
saveArchive(oldMemories);
for (const m of oldMemories) {
  await manager.deleteMemory(m.id);
}
```

## Next Steps

1. ✅ Memory system implemented
2. ✅ Integrated into the TypeScript agents (`legal-agent.ts`,
   `engineering-agent.ts`, `accounting-agent.ts` all call
   `injectMemoryContext()` then `extractAndSaveMemory()`)
3. 🔄 Keep the two ports in sync — `lib/memory/` and `python/app/memory.py`
   read the same files, so a format change in one must land in the other
4. 🔄 Monitor memory quality
5. 🔄 Export/archive old memories
6. 🔄 Refine extraction logic based on usage

---

**Summary**: The memory system is transparent to agents—just inject context before calling the LLM, and save learnings after. The system automatically manages file persistence, ranking, and tagging.
