/**
 * Multi-LLM Provider Abstraction Layer
 * Supports TokenRouter, Anthropic Claude, and future providers
 */

export interface Citation {
  page_number: number;
  section_reference: string;
  quote?: string;
}

export interface LLMRequest {
  system_prompt: string;
  user_message: string;
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  retry_count?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokens_used: {
    input: number;
    output: number;
  };
  citations: Citation[];
  provider_name: string;
}

export interface LLMProvider {
  name: string;
  call(request: LLMRequest): Promise<LLMResponse>;
  isAvailable(): Promise<boolean>;
  getModelName(): string;
}

export interface LLMConfig {
  provider: 'tokenrouter' | 'anthropic' | 'openrouter';
  tokenrouter?: {
    apiKey: string;
    endpoint: string;
    model: string;
  };
  anthropic?: {
    apiKey: string;
  };
  openrouter?: {
    apiKey: string;
    endpoint: string;
    model: string;
  };
  timeout_ms?: number;
  max_retries?: number;
}

export interface ProviderMetrics {
  provider: string;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  avg_response_time_ms: number;
  total_tokens_used: number;
}
