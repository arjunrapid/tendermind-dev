import { LLMProvider, LLMRequest, LLMResponse } from './types';

/**
 * Anthropic Claude Provider Implementation
 * Fallback provider for redundancy and compatibility
 */
export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private model: string;
  private timeout_ms: number;
  private max_retries: number;

  constructor(apiKey: string, options?: {
    model?: string;
    timeout_ms?: number;
    max_retries?: number;
  }) {
    this.apiKey = apiKey;
    this.model = options?.model || 'claude-3-5-sonnet-20241022';
    this.timeout_ms = options?.timeout_ms || 30000;
    this.max_retries = options?.max_retries || 2;
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Quick availability check - just verify API key validity
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      return response.status < 500;
    } catch (error) {
      console.error('Anthropic availability check failed:', error);
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
          `Anthropic call attempt ${attempt + 1}/${this.max_retries + 1} failed:`,
          lastError.message,
        );

        if (attempt < this.max_retries) {
          await this.exponentialBackoff(attempt);
        }
      }
    }

    throw new Error(
      `Anthropic API failed after ${this.max_retries + 1} attempts: ${lastError?.message}`,
    );
  }

  private async makeRequest(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms || this.timeout_ms);

    try {
      const systemPrompt = request.system_prompt
        ? [{ type: 'text' as const, text: request.system_prompt }]
        : undefined;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.max_tokens || 2048,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: request.user_message,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errorData}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
        model: string;
      };

      const content = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return {
        content,
        model: data.model || this.model,
        tokens_used: {
          input: data.usage?.input_tokens || 0,
          output: data.usage?.output_tokens || 0,
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
