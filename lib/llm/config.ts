import { LLMConfig } from './types';

/**
 * LLM Configuration Management
 * Loads configuration from environment variables.
 *
 * All configured providers' credentials are loaded unconditionally (not just
 * the primary one) so that whichever provider(s) have keys set are available
 * as fallback candidates, regardless of which one is selected as primary.
 */

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || 'openrouter') as
    | 'tokenrouter'
    | 'anthropic'
    | 'openrouter';

  const config: LLMConfig = {
    provider,
    timeout_ms: parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10),
    max_retries: parseInt(process.env.LLM_MAX_RETRIES || '2', 10),
  };

  if (process.env.TOKENROUTER_API_KEY) {
    config.tokenrouter = {
      apiKey: process.env.TOKENROUTER_API_KEY,
      endpoint: process.env.TOKENROUTER_ENDPOINT || 'https://api.tokenrouter.com/v1',
      model: process.env.TOKENROUTER_MODEL || 'qwen/qwen3.8-max-free',
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    config.openrouter = {
      apiKey: process.env.OPENROUTER_API_KEY,
      endpoint: process.env.OPENROUTER_ENDPOINT || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
    };
  }

  // The selected primary provider must have credentials configured.
  if (provider === 'tokenrouter' && !config.tokenrouter) {
    throw new Error(
      'TOKENROUTER_API_KEY environment variable is required when LLM_PROVIDER=tokenrouter',
    );
  }
  if (provider === 'anthropic' && !config.anthropic) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required when LLM_PROVIDER=anthropic',
    );
  }
  if (provider === 'openrouter' && !config.openrouter) {
    throw new Error(
      'OPENROUTER_API_KEY environment variable is required when LLM_PROVIDER=openrouter',
    );
  }

  if (!config.tokenrouter && !config.anthropic && !config.openrouter) {
    console.warn(
      'No LLM provider credentials found at all. Set at least one of TOKENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY.',
    );
  }

  return config;
}

export function validateConfig(config: LLMConfig): void {
  if (!config.provider) {
    throw new Error('LLM_PROVIDER must be specified');
  }

  if (config.provider === 'tokenrouter') {
    if (!config.tokenrouter?.apiKey) {
      throw new Error('TokenRouter API key is required');
    }
    if (!config.tokenrouter.endpoint) {
      throw new Error('TokenRouter endpoint is required');
    }
    if (!config.tokenrouter.model) {
      throw new Error('TokenRouter model is required');
    }
  }

  if (config.provider === 'anthropic') {
    if (!config.anthropic?.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  if (config.provider === 'openrouter') {
    if (!config.openrouter?.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
    if (!config.openrouter.model) {
      throw new Error('OpenRouter model is required');
    }
  }
}

/**
 * Environment variable documentation
 */
export const ENV_VAR_DOCS = {
  LLM_PROVIDER: 'Primary LLM provider: "openrouter" (default), "tokenrouter", or "anthropic"',
  OPENROUTER_API_KEY: 'API key for OpenRouter (https://openrouter.ai/keys)',
  OPENROUTER_ENDPOINT: 'OpenRouter API endpoint (default: https://openrouter.ai/api/v1)',
  OPENROUTER_MODEL: 'Model slug on OpenRouter (default: google/gemini-2.0-flash-001) - check https://openrouter.ai/models for the current latest Gemini slug',
  TOKENROUTER_API_KEY: 'API key for TokenRouter service',
  TOKENROUTER_ENDPOINT: 'TokenRouter API endpoint (default: https://api.tokenrouter.com/v1)',
  TOKENROUTER_MODEL: 'Model to use on TokenRouter (default: qwen/qwen3.8-max-free)',
  ANTHROPIC_API_KEY: 'API key for Anthropic Claude (used as fallback)',
  LLM_TIMEOUT_MS: 'Request timeout in milliseconds (default: 30000)',
  LLM_MAX_RETRIES: 'Number of retries on failure (default: 2)',
};
