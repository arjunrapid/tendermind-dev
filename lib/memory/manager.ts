/**
 * Agent Memory Manager
 * Handles file-based persistent memory for agents
 */

import fs from 'fs';
import path from 'path';
import { AgentMemory, MemorySearchParams, MemoryType } from './types';

const MEMORY_DIR = path.join(process.cwd(), 'memory', 'agents');

export class MemoryManager {
  private memories: Map<string, AgentMemory> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }

      // Load all memories from disk
      await this.loadFromDisk();
      this.initialized = true;
      console.log(`Memory manager initialized with ${this.memories.size} memories`);
    } catch (error) {
      console.error('Error initializing memory manager:', error);
    }
  }

  async saveMemory(memory: AgentMemory): Promise<void> {
    await this.initialize();

    const id = memory.id || this.generateId();
    const memoryWithId = { ...memory, id };

    // Update metadata
    memoryWithId.metadata.updated_at = new Date().toISOString();
    memoryWithId.metadata.last_used = new Date().toISOString();

    this.memories.set(id, memoryWithId);

    // Persist to disk
    await this.saveToDisk(id, memoryWithId);
  }

  async getMemory(id: string): Promise<AgentMemory | null> {
    await this.initialize();
    return this.memories.get(id) || null;
  }

  async searchMemories(params: MemorySearchParams): Promise<AgentMemory[]> {
    await this.initialize();

    let results = Array.from(this.memories.values());

    // Filter by agent
    if (params.agent) {
      results = results.filter((m) => m.agent === params.agent);
    }

    // Filter by type
    if (params.type) {
      results = results.filter((m) => m.type === params.type);
    }

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      results = results.filter((m) =>
        params.tags!.some((tag) => m.metadata.tags?.includes(tag)),
      );
    }

    // Search by query in content
    if (params.query) {
      const query = params.query.toLowerCase();
      results = results.filter(
        (m) =>
          m.content.toLowerCase().includes(query) ||
          m.metadata.tags?.some((t) => t.toLowerCase().includes(query)),
      );
    }

    // Sort by usage count and recency
    results.sort((a, b) => {
      const usageDiff = b.metadata.usage_count - a.metadata.usage_count;
      if (usageDiff !== 0) return usageDiff;
      return (
        new Date(b.metadata.last_used).getTime() -
        new Date(a.metadata.last_used).getTime()
      );
    });

    return results.slice(0, params.limit || 10);
  }

  async getMemoriesForAgent(
    agent: string,
    limit: number = 5,
  ): Promise<AgentMemory[]> {
    return this.searchMemories({ agent, limit });
  }

  async recordMemoryUsage(memoryId: string): Promise<void> {
    const memory = this.memories.get(memoryId);
    if (memory) {
      memory.metadata.usage_count++;
      memory.metadata.last_used = new Date().toISOString();
      await this.saveToDisk(memoryId, memory);
    }
  }

  async deleteMemory(id: string): Promise<void> {
    this.memories.delete(id);
    const filePath = path.join(MEMORY_DIR, `${id}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error deleting memory file ${id}:`, error);
    }
  }

  /**
   * Delete all memories that were learned from a specific bid's analysis.
   * Used when a bid document is removed from history, so stale learnings
   * from a deleted document stop being injected into future agent runs.
   */
  async deleteMemoriesForBid(bidId: string): Promise<number> {
    await this.initialize();

    const toDelete = Array.from(this.memories.values()).filter(
      (m) => m.metadata.source_bid_id === bidId,
    );

    for (const memory of toDelete) {
      await this.deleteMemory(memory.id);
    }

    return toDelete.length;
  }

  async exportMemories(agent?: string): Promise<AgentMemory[]> {
    await this.initialize();
    let memories = Array.from(this.memories.values());

    if (agent) {
      memories = memories.filter((m) => m.agent === agent);
    }

    return memories;
  }

  async importMemories(memories: AgentMemory[]): Promise<void> {
    for (const memory of memories) {
      await this.saveMemory(memory);
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        return;
      }

      const files = fs.readdirSync(MEMORY_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(MEMORY_DIR, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const memory: AgentMemory = JSON.parse(content);
          this.memories.set(memory.id, memory);
        }
      }
    } catch (error) {
      console.error('Error loading memories from disk:', error);
    }
  }

  private async saveToDisk(id: string, memory: AgentMemory): Promise<void> {
    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }

      const filePath = path.join(MEMORY_DIR, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
    } catch (error) {
      console.error(`Error saving memory ${id} to disk:`, error);
    }
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getMemoryStats(): { total: number; byAgent: Record<string, number>; byType: Record<string, number> } {
    const stats = {
      total: this.memories.size,
      byAgent: {} as Record<string, number>,
      byType: {} as Record<string, number>,
    };

    this.memories.forEach((memory) => {
      stats.byAgent[memory.agent] = (stats.byAgent[memory.agent] || 0) + 1;
      stats.byType[memory.type] = (stats.byType[memory.type] || 0) + 1;
    });

    return stats;
  }
}

// Singleton instance
let manager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!manager) {
    manager = new MemoryManager();
  }
  return manager;
}
