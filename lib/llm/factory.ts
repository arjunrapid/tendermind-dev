import { LLMProvider, LLMRequest, LLMResponse, LLMConfig } from './types';
import { TokenRouterProvider } from './tokenrouter';
import { AnthropicProvider } from './anthropic';
import { OpenRouterProvider } from './openrouter';
import { getLLMConfig } from './config';

/**
 * LLM Provider Factory with Fallback Support
 * Manages provider selection and automatic fallback on errors.
 *
 * The primary provider is whichever LLM_PROVIDER selects. The fallback is
 * the first other provider (in priority order) that has credentials
 * configured, regardless of which one is primary.
 */

const FALLBACK_PRIORITY: Array<'anthropic' | 'openrouter' | 'tokenrouter'> = [
  'anthropic',
  'openrouter',
  'tokenrouter',
];

class LLMProviderFactory {
  private primaryProvider: LLMProvider | null = null;
  private fallbackProvider: LLMProvider | null = null;
  private metrics = {
    primary: { calls: 0, failures: 0, total_time_ms: 0 },
    fallback: { calls: 0, failures: 0, total_time_ms: 0 },
  };

  constructor() {
    this.initializeProviders();
  }

  private buildProvider(
    type: 'tokenrouter' | 'anthropic' | 'openrouter',
    config: LLMConfig,
    isPrimary: boolean,
  ): LLMProvider | null {
    if (type === 'tokenrouter' && config.tokenrouter) {
      return new TokenRouterProvider(config.tokenrouter.apiKey, {
        endpoint: config.tokenrouter.endpoint,
        model: config.tokenrouter.model,
        timeout_ms: config.timeout_ms,
        max_retries: isPrimary ? config.max_retries : 1,
      });
    }
    if (type === 'anthropic' && config.anthropic) {
      return new AnthropicProvider(config.anthropic.apiKey, {
        timeout_ms: config.timeout_ms,
        max_retries: isPrimary ? config.max_retries : 1,
      });
    }
    if (type === 'openrouter' && config.openrouter) {
      return new OpenRouterProvider(config.openrouter.apiKey, {
        endpoint: config.openrouter.endpoint,
        model: config.openrouter.model,
        timeout_ms: config.timeout_ms,
        max_retries: isPrimary ? config.max_retries : 1,
      });
    }
    return null;
  }

  private initializeProviders(): void {
    const config = getLLMConfig();

    this.primaryProvider = this.buildProvider(config.provider, config, true);

    if (!this.primaryProvider) {
      throw new Error(
        'No LLM provider configured. Set LLM_PROVIDER env var and corresponding API keys.',
      );
    }

    // Fallback: first provider in priority order that isn't the primary and has credentials.
    for (const type of FALLBACK_PRIORITY) {
      if (type === config.provider) continue;
      const candidate = this.buildProvider(type, config, false);
      if (candidate) {
        this.fallbackProvider = candidate;
        break;
      }
    }
  }

  /**
   * Call the primary provider with automatic fallback on failure
   */
  async call(request: LLMRequest): Promise<LLMResponse & { provider_used: string }> {
    const startTime = Date.now();

    // Try primary provider
    if (this.primaryProvider) {
      try {
        const response = await this.primaryProvider.call(request);
        const elapsed = Date.now() - startTime;
        this.metrics.primary.calls++;
        this.metrics.primary.total_time_ms += elapsed;

        return {
          ...response,
          provider_used: this.primaryProvider.name,
        };
      } catch (primaryError) {
        this.metrics.primary.failures++;
        console.warn(
          `Primary provider (${this.primaryProvider.name}) failed, attempting fallback:`,
          primaryError,
        );

        // Try fallback provider if available
        if (this.fallbackProvider) {
          try {
            const response = await this.fallbackProvider.call(request);
            const elapsed = Date.now() - startTime;
            this.metrics.fallback.calls++;
            this.metrics.fallback.total_time_ms += elapsed;

            console.log(
              `Fallback provider (${this.fallbackProvider.name}) succeeded after ${elapsed}ms`,
            );

            return {
              ...response,
              provider_used: this.fallbackProvider.name,
            };
          } catch (fallbackError) {
            this.metrics.fallback.failures++;
            throw new Error(
              `Both primary and fallback providers failed.\n` +
              `Primary: ${primaryError}\n` +
              `Fallback: ${fallbackError}`,
            );
          }
        } else {
          // No fallback available
          throw primaryError;
        }
      }
    }

    throw new Error('No LLM provider available');
  }

  /**
   * Get the name of the provider that will be used (for display/logging)
   */
  getPrimaryProviderName(): string {
    return this.primaryProvider?.name || 'unknown';
  }

  /**
   * Get metrics about provider usage
   */
  getMetrics() {
    return {
      primary: {
        name: this.primaryProvider?.name,
        ...this.metrics.primary,
        avg_response_time_ms:
          this.metrics.primary.calls > 0
            ? Math.round(this.metrics.primary.total_time_ms / this.metrics.primary.calls)
            : 0,
      },
      fallback: {
        name: this.fallbackProvider?.name,
        ...this.metrics.fallback,
        avg_response_time_ms:
          this.metrics.fallback.calls > 0
            ? Math.round(this.metrics.fallback.total_time_ms / this.metrics.fallback.calls)
            : 0,
      },
    };
  }

  /**
   * Check if fallback provider is available
   */
  async hasFallback(): Promise<boolean> {
    if (!this.fallbackProvider) return false;
    return this.fallbackProvider.isAvailable();
  }
}

// Singleton instance
let factory: LLMProviderFactory | null = null;

export function getLLMFactory(): LLMProviderFactory {
  if (!factory) {
    factory = new LLMProviderFactory();
  }
  return factory;
}

/**
 * Convenience function for calling LLM with automatic provider fallback
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse & { provider_used: string }> {
  return getLLMFactory().call(request);
}

/**
 * Get current provider metrics
 */
export function getLLMMetrics() {
  return getLLMFactory().getMetrics();
}
