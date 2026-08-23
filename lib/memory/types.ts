/**
 * Agent Memory System
 * Persists learnings from previous analyses and injects context into agents
 */

export type MemoryType = 'clause_extraction' | 'classification' | 'risk_pattern' | 'cost_estimation' | 'general';

export interface AgentMemory {
  id: string;
  type: MemoryType;
  agent: 'legal' | 'engineering' | 'accounting' | 'risk' | 'general';
  content: string;
  metadata: {
    source_bid_id?: string;
    source_document?: string;
    confidence?: number;
    tags?: string[];
    created_at: string;
    updated_at: string;
    usage_count: number;
    last_used: string;
  };
}

export interface MemoryContext {
  memories: AgentMemory[];
  total_memories: number;
  relevant_count: number;
  context_text: string;
}

export interface MemorySearchParams {
  agent?: string;
  type?: MemoryType;
  tags?: string[];
  limit?: number;
  query?: string;
}

export interface ExtractedPattern {
  pattern: string;
  examples: string[];
  confidence: number;
  frequency: number;
}
