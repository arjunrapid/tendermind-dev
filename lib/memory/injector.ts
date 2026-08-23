/**
 * Memory Injector
 * Injects relevant memories into agent prompts for context
 */

import { MemoryContext } from './types';
import { getMemoryManager } from './manager';

export class MemoryInjector {
  /**
   * Get relevant memories for an agent and format as context
   */
  async getMemoryContext(
    agent: 'legal' | 'engineering' | 'accounting' | 'risk',
    documentText?: string,
    limit: number = 5,
  ): Promise<MemoryContext> {
    const manager = getMemoryManager();

    // Get memories for this agent
    let memories = await manager.getMemoriesForAgent(agent, limit * 2);

    // If document text provided, score by relevance
    if (documentText && memories.length > 0) {
      memories = this.rankByRelevance(memories, documentText).slice(0, limit);
    }

    // Record usage for top memories
    for (const memory of memories.slice(0, 3)) {
      await manager.recordMemoryUsage(memory.id);
    }

    const contextText = this.formatMemoriesAsContext(memories, agent);

    return {
      memories,
      total_memories: memories.length,
      relevant_count: memories.length,
      context_text: contextText,
    };
  }

  /**
   * Inject memory context into a prompt
   */
  async injectMemoryContext(
    systemPrompt: string,
    agent: 'legal' | 'engineering' | 'accounting' | 'risk',
    documentText?: string,
  ): Promise<string> {
    const memoryContext = await this.getMemoryContext(agent, documentText);

    if (memoryContext.memories.length === 0) {
      return systemPrompt;
    }

    // Append memory context to system prompt
    return `${systemPrompt}

## RELEVANT LEARNINGS FROM PREVIOUS ANALYSES
${memoryContext.context_text}

Use the above learnings to inform your analysis, but always prioritize the current document's specific requirements.`;
  }

  /**
   * Extract learnings from agent response and save as memory
   */
  async extractAndSaveMemory(
    agent: 'legal' | 'engineering' | 'accounting' | 'risk',
    response: string,
    bidId: string,
    documentType: string,
  ): Promise<string> {
    const manager = getMemoryManager();

    // Extract key findings
    const keyFindings = this.extractKeyFindings(response, agent);

    if (!keyFindings) {
      return ''; // No significant learning to save
    }

    const memory = {
      id: '',
      type: this.getMemoryType(agent),
      agent,
      content: keyFindings,
      metadata: {
        source_bid_id: bidId,
        source_document: documentType,
        confidence: 0.85,
        tags: this.generateTags(agent, keyFindings),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0,
        last_used: new Date().toISOString(),
      },
    };

    await manager.saveMemory(memory);
    console.log(`Saved memory from ${agent} agent for bid ${bidId}`);

    return memory.id;
  }

  private rankByRelevance(
    memories: Array<any>,
    documentText: string,
  ): Array<any> {
    const textLower = documentText.toLowerCase();

    return memories.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a.content, a.metadata?.tags || [], textLower);
      const scoreB = this.calculateRelevanceScore(b.content, b.metadata?.tags || [], textLower);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(
    content: string,
    tags: string[],
    documentText: string,
  ): number {
    let score = 0;

    // Score based on content match
    const words = content.toLowerCase().split(/\s+/);
    words.forEach((word) => {
      if (word.length > 4 && documentText.includes(word)) {
        score += 1;
      }
    });

    // Boost for matching tags
    tags.forEach((tag) => {
      if (documentText.includes(tag.toLowerCase())) {
        score += 3;
      }
    });

    return score;
  }

  private formatMemoriesAsContext(
    memories: Array<{ content: string; metadata: { tags?: string[]; usage_count: number } }>,
    agent: string,
  ): string {
    if (memories.length === 0) {
      return `No previous learnings available for ${agent} analysis.`;
    }

    const lines = [
      `Based on ${memories.length} previous ${agent} analyses:`,
      '',
    ];

    memories.forEach((memory, index) => {
      lines.push(`${index + 1}. ${memory.content}`);
      if (memory.metadata.tags && memory.metadata.tags.length > 0) {
        lines.push(`   Tags: ${memory.metadata.tags.join(', ')}`);
      }
      lines.push(`   Used ${memory.metadata.usage_count} times`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private extractKeyFindings(response: string, agent: string): string | null {
    // Extract the most important 1-2 lines from the response
    // This is simplified - in production, would use more sophisticated NLP
    const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 20);

    if (sentences.length === 0) {
      return null;
    }

    // Take the most substantial sentence(s)
    return sentences
      .slice(0, 2)
      .map((s) => s.trim())
      .join('. ');
  }

  private getMemoryType(agent: string): 'clause_extraction' | 'classification' | 'risk_pattern' | 'cost_estimation' | 'general' {
    switch (agent) {
      case 'legal':
        return 'clause_extraction';
      case 'engineering':
        return 'classification';
      case 'accounting':
        return 'cost_estimation';
      case 'risk':
        return 'risk_pattern';
      default:
        return 'general';
    }
  }

  private generateTags(agent: string, content: string): string[] {
    const tags = [agent];

    // Auto-generate tags based on content keywords
    const keywords = {
      legal: ['LD', 'retention', 'termination', 'warranty', 'indemnity', 'arbitration'],
      engineering: ['scope', 'timeline', 'site', 'drawing', 'specification'],
      accounting: ['cost', 'payment', 'qualification', 'criteria', 'experience'],
      risk: ['risk', 'mitigation', 'gap', 'compliance', 'exposure'],
    };

    const agentKeywords = keywords[agent as keyof typeof keywords] || [];
    agentKeywords.forEach((keyword) => {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        tags.push(keyword);
      }
    });

    return tags;
  }
}

// Singleton instance
let injector: MemoryInjector | null = null;

export function getMemoryInjector(): MemoryInjector {
  if (!injector) {
    injector = new MemoryInjector();
  }
  return injector;
}
