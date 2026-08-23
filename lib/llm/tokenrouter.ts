import { LLMProvider, LLMRequest, LLMResponse } from './types';

/**
 * TokenRouter Provider Implementation
 * Cost-effective LLM access via https://api.tokenrouter.com/v1
 * Model: qwen/qwen3.8-max-free
 */
export class TokenRouterProvider implements LLMProvider {
  name = 'tokenrouter';
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private timeout_ms: number;
  private max_retries: number;

  constructor(apiKey: string, options?: {
    endpoint?: string;
    model?: string;
    timeout_ms?: number;
    max_retries?: number;
  }) {
    this.apiKey = apiKey;
    this.endpoint = options?.endpoint || 'https://api.tokenrouter.com/v1';
    this.model = options?.model || 'qwen/qwen3.8-max-free';
    this.timeout_ms = options?.timeout_ms || 30000;
    this.max_retries = options?.max_retries || 2;
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${this.endpoint}/models`, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          signal: controller.signal,
        });
        return response.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error('TokenRouter availability check failed:', error);
      return false;
    }
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.max_retries; attempt++) {
      try {
        const response = await this.makeRequest(request);
        return response;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `TokenRouter call attempt ${attempt + 1}/${this.max_retries + 1} failed:`,
          lastError.message,
        );

        if (attempt < this.max_retries) {
          await this.exponentialBackoff(attempt);
        }
      }
    }

    throw new Error(
      `TokenRouter API failed after ${this.max_retries + 1} attempts: ${lastError?.message}`,
    );
  }

  private async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms || this.timeout_ms);

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: request.system_prompt },
            { role: 'user', content: request.user_message },
          ],
          max_tokens: request.max_tokens || 2048,
          temperature: request.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`TokenRouter API error ${response.status}: ${errorData}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
        model: string;
      };

      const content = data.choices[0]?.message?.content || '';

      return {
        content,
        model: data.model || this.model,
        tokens_used: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
        },
        citations: this.extractCitations(content),
        provider_name: this.name,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractCitations(content: string): Array<{ page_number: number; section_reference: string }> {
    // Matches [page:5, section:Art. 6.2], [p5, Clause 3.2], [page 5], etc. -
    // accepts any label after the page number, not just "section"/"art".
    const pattern = /\[p(?:age)?[:\s]*(\d+)(?:[,\s]+([^\]]+))?\]/gi;
    const citations: Array<{ page_number: number; section_reference: string }> = [];

    let match;
    while ((match = pattern.exec(content)) !== null) {
      citations.push({
        page_number: parseInt(match[1], 10),
        section_reference: match[2]?.trim() || '',
      });
    }

    return citations;
  }

  private async exponentialBackoff(attempt: number): Promise<void> {
    const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
